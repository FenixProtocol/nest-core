// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.19;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {SafeERC20Upgradeable, IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

import {IRouterV2} from "../dexV2/interfaces/IRouterV2.sol";
import {IRouterV2PathProvider} from "./interfaces/IRouterV2PathProvider.sol";
import {ISingleTokenBuyback} from "./interfaces/ISingleTokenBuyback.sol";

/**
 * @title Single Token Buyback Upgradeable Contract
 * @notice Implements token buyback functionality using DEX V2 Router.
 * @dev THE CONTRACT IS DEPREACTED AND NO LONGER USED
 * @dev THE CONTRACT MUST STAY TO NOT BREAK STORAGE IN THE CompoundVeNESTManagedNFTStrategyUpgradeable CONTRACT
 * @dev DON'T USE THE CONTRACT IN NEW CONTRACTS
 */
abstract contract SingleTokenBuybackUpgradeable is ISingleTokenBuyback, Initializable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    /**
     *  @dev Emitted when the input token for a buyback operation is the same as the target token.
     */
    error IncorrectInputToken();

    /**
     * @dev Emitted when the slippage specified for a buyback exceeds the maximum allowable limit.
     */
    error IncorrectSlippage();

    /**
     * @dev Emitted when attempting a buyback with an empty balance.
     */
    error ZeroBalance();

    /**
     * @dev Emitted when the input routes provided for a buyback are invalid or do not conform to expected standards
     */
    error InvalidInputRoutes();

    /**
     * @dev Emitted when no viable route is found for the buyback operation.
     */
    error RouteNotFound();

    /**
     * @dev Emitted when a function argument is expected to be a valid address but receives a zero address.
     */
    error ZeroAddress();

    /**
     * @notice Maximum slippage allowed for buyback operations, represented in basis points.
     * @dev Slippage is capped at 400 basis points (4%).
     */
    uint256 public constant MAX_SLIPPAGE = 400;

    /**
     * @notice Precision used for representing slippage percentages.
     * @dev Slippage calculations are based on a granularity of 10,000 to represent 100%.
     */
    uint256 public constant SLIPPAGE_PRECISION = 10_000;

    /**
     *
     * @notice Address of the Router V2 Path Provider used for fetching and calculating optimal token swap routes.
     * @dev This address is utilized to access routing functionality for executing token buybacks.
     */
    address public override routerV2PathProvider;

    /**
     * @notice Ensures the slippage value is within the acceptable range.
     * @param slippage_ The slippage value to check.
     * @dev Reverts with IncorrectSlippage if the slippage exceeds the maximum allowed.
     */
    modifier onlyCorrectSlippage(uint256 slippage_) {
        if (slippage_ > MAX_SLIPPAGE) {
            revert IncorrectSlippage();
        }
        _;
    }

    /**
     * @notice Ensures the provided token is not the target buyback token.
     * @param token_ The token address to check.
     * @dev Reverts with IncorrectInputToken if the token address matches the buyback target token.
     */
    modifier onlyCorrectInputToken(address token_) {
        _checkAddressZero(token_);
        if (token_ == _getBuybackTargetToken()) {
            revert IncorrectInputToken();
        }
        _;
    }

    /**
     * @notice Initializes the buyback contract with the address of the router V2 path provider.
     * @param routerV2PathProvider_ The address of the router V2 path provider to be set.
     * @dev This function should be called from the contract's initializer function.
     */
    function __SingelTokenBuyback__init(address routerV2PathProvider_) internal onlyInitializing {
        _checkAddressZero(routerV2PathProvider_);

        routerV2PathProvider = routerV2PathProvider_;
    }

    /**
     * @notice Retrieves the target token for buybacks.
     * @dev Provides an abstraction layer over internal details, potentially allowing for dynamic updates in the future.
     * @return The address of the token targeted for buyback operations.
     */
    function getBuybackTargetToken() external view returns (address) {
        return _getBuybackTargetToken();
    }

    /**
     * @dev Internal function to enforce permissions or rules before allowing a buyback swap to proceed.
     */
    function _checkBuybackSwapPermissions() internal view virtual;

    /**
     * @dev Internal helper to fetch the target token for buybacks.
     * @return The address of the buyback target token.
     */
    function _getBuybackTargetToken() internal view virtual returns (address);

    /**
     * @dev Checked provided address on zero value, throw AddressZero error in case when addr_ is zero
     *
     * @param addr_ The address which will checked on zero
     */
    function _checkAddressZero(address addr_) internal pure virtual {
        if (addr_ == address(0)) {
            revert ZeroAddress();
        }
    }

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[50] private __gap;
}
