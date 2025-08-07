// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.19;

import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {ICompoundVeNESTManagedNFTStrategyFactory} from "./interfaces/ICompoundVeNESTManagedNFTStrategyFactory.sol";
import {ISingelTokenVirtualRewarder} from "./interfaces/ISingelTokenVirtualRewarder.sol";
import {ICompoundVeNESTManagedNFTStrategy} from "./interfaces/ICompoundVeNESTManagedNFTStrategy.sol";
import {StrategyProxy} from "./StrategyProxy.sol";
import {VirtualRewarderProxy} from "./VirtualRewarderProxy.sol";

/**
 * @title Factory for Compound VeNEST Managed NFT Strategies and Virtual Rewarders
 * @notice This contract serves as a factory for creating and initializing managed NFT strategies and their corresponding virtual rewarders in the Compound VeNEST ecosystem.
 * It uses proxy contracts for strategy and rewarder creation to ensure upgradability.
 */
contract CompoundVeNESTManagedNFTStrategyFactoryUpgradeable is
    ICompoundVeNESTManagedNFTStrategyFactory,
    AccessControlUpgradeable
{
    /**
     * @notice Role identifier used for granting permissions to create new strategies.
     */
    bytes32 public constant STRATEGY_CREATOR_ROLE = keccak256("STRATEGY_CREATOR_ROLE");

    /**
     * @notice Address of the current strategy implementation used for creating new strategies
     */
    address public override strategyImplementation;

    /**
     * @notice Address of the current virtual rewarder implementation used for creating new rewarders
     */
    address public override virtualRewarderImplementation;

    /**
     * @notice Address of the managed NFT manager interacting with the strategies
     */
    address public override managedNFTManager;

    /**
     * @notice The address of the Router V2 Path Provider used to fetch and calculate optimal routes for token transactions within strategies.
     */
    address public override routerV2PathProvider;

    error AddressZero();

    /**
     * @dev Constructor that disables initialization on implementation.
     */
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializes the factory with the necessary addresses and default configuration.
     * @dev Sets up the contract with initial governance settings, roles, and implementations for strategies and rewarders. Marks the contract as initialized.
     * @param strategyImplementation_ The initial implementation contract for strategies.
     * @param virtualRewarderImplementation_ The initial implementation contract for virtual rewarders.
     * @param managedNFTManager_ The manager address for interacting with managed NFTs.
     * @param routerV2PathProvider_ The address of the router V2 path provider used for fetching and calculating optimal token swap routes.
     */
    function initialize(
        address strategyImplementation_,
        address virtualRewarderImplementation_,
        address managedNFTManager_,
        address routerV2PathProvider_
    ) external initializer {
        _checkAddressZero(strategyImplementation_);
        _checkAddressZero(virtualRewarderImplementation_);
        _checkAddressZero(managedNFTManager_);
        _checkAddressZero(routerV2PathProvider_);

        __AccessControl_init();

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(STRATEGY_CREATOR_ROLE, msg.sender);

        strategyImplementation = strategyImplementation_;
        virtualRewarderImplementation = virtualRewarderImplementation_;
        managedNFTManager = managedNFTManager_;
        routerV2PathProvider = routerV2PathProvider_;
    }

    /**
     * @notice Creates a new strategy and corresponding virtual rewarder with a specified name
     * @dev Requires the caller to have the STRATEGY_CREATOR_ROLE
     * @param name_ Descriptive name for the new strategy
     * @return The address of the newly created strategy instance
     */
    function createStrategy(string calldata name_) external override onlyRole(STRATEGY_CREATOR_ROLE) returns (address) {
        ICompoundVeNESTManagedNFTStrategy strategy = ICompoundVeNESTManagedNFTStrategy(address(new StrategyProxy()));
        ISingelTokenVirtualRewarder virtualRewarder = ISingelTokenVirtualRewarder(address(new VirtualRewarderProxy()));

        strategy.initialize(managedNFTManager, address(virtualRewarder), routerV2PathProvider, name_);
        virtualRewarder.initialize(address(strategy));

        emit CreateStrategy(address(strategy), address(virtualRewarder), name_);

        return address(strategy);
    }

    /**
     * @notice Updates the implementation address for virtual rewarders
     * @dev Only accessible by admins with DEFAULT_ADMIN_ROLE
     * @param virtualRewarderImplementation_ New implementation address for virtual rewarders
     */
    function changeVirtualRewarderImplementation(address virtualRewarderImplementation_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _checkAddressZero(virtualRewarderImplementation_);

        emit ChangeVirtualRewarderImplementation(virtualRewarderImplementation, virtualRewarderImplementation_);
        virtualRewarderImplementation = virtualRewarderImplementation_;
    }

    /**
     * @notice Updates the implementation address for strategies
     * @dev Only accessible by admins with DEFAULT_ADMIN_ROLE
     *
     * @param strategyImplementation_ New implementation address for strategies
     */
    function changeStrategyImplementation(address strategyImplementation_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _checkAddressZero(strategyImplementation_);

        emit ChangeStrategyImplementation(strategyImplementation, strategyImplementation_);
        strategyImplementation = strategyImplementation_;
    }

    /**
     * @notice Sets a new address for the Router V2 Path Provider.
     * @dev Accessible only by admins, this function updates the address used for determining swap routes in token buyback strategies.
     * @param routerV2PathProvider_ The new Router V2 Path Provider address.
     */
    function setRouterV2PathProvider(address routerV2PathProvider_) external virtual onlyRole(DEFAULT_ADMIN_ROLE) {
        _checkAddressZero(routerV2PathProvider_);
        emit SetRouterV2PathProvider(routerV2PathProvider, routerV2PathProvider_);

        routerV2PathProvider = routerV2PathProvider_;
    }


    /**
     * @dev Checked provided address on zero value, throw AddressZero error in case when addr_ is zero
     *
     * @param addr_ The address which will checked on zero
     */
    function _checkAddressZero(address addr_) internal pure {
        if (addr_ == address(0)) {
            revert AddressZero();
        }
    }

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[50] private __gap;
}
