// SPDX-License-Identifier: MIT
pragma solidity =0.8.19;

import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {IERC20Upgradeable, SafeERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {ERC721HolderUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/utils/ERC721HolderUpgradeable.sol";

import {IVotingEscrow} from "../../core/interfaces/IVotingEscrow.sol";
import {IVoter} from "../../core/interfaces/IVoter.sol";
import {IBribe} from "../interfaces/IBribe.sol";
import {IBribeVeNESTRewardToken} from "./interfaces/IBribeVeNESTRewardToken.sol";
import {ICustomBribeRewardRouter} from "./interfaces/ICustomBribeRewardRouter.sol";

/**
 * @title CustomBribeRewardRouter
 * @notice This contract facilitates the distribution of NEST-based rewards into external bribe contracts
 *         as veNEST-based intermediary tokens. It converts either direct NEST deposits or veNEST NFTs
 *         (burned to reclaim underlying NEST) into brVeNEST tokens, and then notifies external bribe contracts
 *         of these new rewards.
 *
 * @dev This contract:
 *      - Inherits from ICustomBribeRewardRouter and provides implementations for NEST to brVeNEST reward distribution.
 *      - Allows enabling/disabling certain functions via `funcEnabled` mapping controlled by an admin role.
 *      - Uses a voter contract to derive the correct external bribe contract for a given pool.
 *      - Requires the caller to have appropriate roles and the function to be enabled before executing certain operations.
 */
contract CustomBribeRewardRouter is
    ICustomBribeRewardRouter,
    AccessControlUpgradeable,
    ERC721HolderUpgradeable
{
    using SafeERC20Upgradeable for IERC20Upgradeable;

    /// @notice The address of the intermediate bribe-veNEST reward token.
    address public bribeVeNestRewardToken;

    /// @notice The address of the voter contract used to map pools to gauges and thus to external bribe contracts.
    address public voter;

    /// @notice A mapping of function selectors to a boolean indicating if the function is enabled.
    mapping(bytes4 => bool) public funcEnabled;

    /// @dev Thrown when attempting to call a function that has been disabled.
    error FunctionDisabled();

    /// @dev Thrown when the provided pool does not map to a valid gauge or external bribe contract.
    error InvalidPool(address pool);

    /// @dev Thrown when the retrieved external bribe contract is invalid (e.g., zero address).
    error InvalidBribe(address bribe);

    /**
     * @dev Modifier that checks whether the given function selector is enabled before proceeding.
     *      Reverts with `FunctionDisabled()` if not enabled.
     * @param funcSign_ The 4-byte function selector.
     */
    modifier whenEnabled(bytes4 funcSign_) {
        if (!funcEnabled[funcSign_]) {
            revert FunctionDisabled();
        }
        _;
    }

    /**
     * @notice Constructor for UUPS pattern. The main logic is in the `initialize` function.
     */
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializes the contract.
     * @dev Grants DEFAULT_ADMIN_ROLE to the caller. Sets the voter and bribeVeNestRewardToken addresses.
     * @param voter_ The address of the voter contract used to map pools to gauges and external bribes.
     * @param bribeVeNestRewardToken_ The address of the brVeNEST token contract.
     */
    function initialize(address voter_, address bribeVeNestRewardToken_) external initializer {
        __AccessControl_init();
        __ERC721Holder_init();

        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());

        voter = voter_;
        bribeVeNestRewardToken = bribeVeNestRewardToken_;
    }

    /**
     * @notice Enables or disables a specific function based on its selector.
     * @dev Only callable by addresses with DEFAULT_ADMIN_ROLE.
     * @param funcSign_ The function selector for which the state is being changed.
     * @param isEnable_ True to enable the function, false to disable.
     *
     * Emits a {FuncEnabled} event.
     */
    function setupFuncEnable(bytes4 funcSign_, bool isEnable_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        funcEnabled[funcSign_] = isEnable_;
        emit FuncEnabled(funcSign_, isEnable_);
    }

    /**
     * @notice Notifies an external bribe contract of NEST-based rewards by converting NEST into brVeNEST tokens.
     * @dev NEST tokens are transferred from the caller to this contract, then converted into brVeNEST tokens,
     *      and finally notified to the external bribe contract associated with the given pool.
     * @param pool_ The address of the pool for which the reward is being distributed.
     * @param amount_ The amount of NEST to convert and distribute as brVeNEST rewards.
     *
     * Emits a {NotifyRewardNESTInVeNest} event.
     * Reverts if the function is disabled or the pool is invalid.
     */
    function notifyRewardNESTInVeNEST(
        address pool_,
        uint256 amount_
    ) external whenEnabled(ICustomBribeRewardRouter.notifyRewardNESTInVeNEST.selector) {
        IBribeVeNESTRewardToken bribeVeNestRewardTokenCache = IBribeVeNESTRewardToken(bribeVeNestRewardToken);
        IERC20Upgradeable token = IERC20Upgradeable(bribeVeNestRewardTokenCache.underlyingToken());

        token.safeTransferFrom(_msgSender(), address(this), amount_);

        token.forceApprove(address(bribeVeNestRewardTokenCache), amount_);
        bribeVeNestRewardTokenCache.mint(address(this), amount_);

        address externalBribe = _getExternalBribe(pool_);

        IERC20Upgradeable(bribeVeNestRewardTokenCache).forceApprove(externalBribe, amount_);
        IBribe(externalBribe).notifyRewardAmount(address(bribeVeNestRewardTokenCache), amount_);
        emit NotifyRewardNESTInVeNest(_msgSender(), pool_, externalBribe, amount_);
    }

    /**
     * @notice Notifies an external bribe contract using NEST reclaimed from burning a veNEST NFT.
     * @dev A veNEST NFT is transferred from the caller to this contract, burned to reclaim NEST,
     *      then converted into brVeNEST, and finally notified to the external bribe contract.
     * @param pool_ The address of the pool for which the reward is being distributed.
     * @param tokenId_ The ID of the veNEST NFT to be burned to reclaim NEST.
     *
     * Emits a {NotifyRewardVeNESTInVeNest} event.
     * Reverts if the function is disabled, the pool is invalid, or the NFT is not eligible to be burned.
     */
    function notifyRewardVeNESTInVeNest(
        address pool_,
        uint256 tokenId_
    ) external whenEnabled(ICustomBribeRewardRouter.notifyRewardVeNESTInVeNest.selector) {
        IBribeVeNESTRewardToken bribeVeNestRewardTokenCache = IBribeVeNESTRewardToken(bribeVeNestRewardToken);
        IERC20Upgradeable token = IERC20Upgradeable(bribeVeNestRewardTokenCache.underlyingToken());
        IVotingEscrow votingEscrow = IVotingEscrow(bribeVeNestRewardTokenCache.votingEscrow());

        votingEscrow.safeTransferFrom(_msgSender(), address(this), tokenId_, "");

        uint256 balanceBefore = token.balanceOf(address(this));

        if (votingEscrow.getNftState(tokenId_).locked.isPermanentLocked) {
            votingEscrow.unlockPermanent(tokenId_);
        }

        votingEscrow.burnToBribes(tokenId_);
        uint256 amount = token.balanceOf(address(this)) - balanceBefore;

        token.forceApprove(address(bribeVeNestRewardTokenCache), amount);
        bribeVeNestRewardTokenCache.mint(address(this), amount);

        address externalBribe = _getExternalBribe(pool_);

        IERC20Upgradeable(bribeVeNestRewardTokenCache).forceApprove(externalBribe, amount);
        IBribe(externalBribe).notifyRewardAmount(address(bribeVeNestRewardTokenCache), amount);

        emit NotifyRewardVeNESTInVeNest(_msgSender(), pool_, externalBribe, tokenId_, amount);
    }

    /**
     * @dev Retrieves the external bribe contract associated with a given pool via the voter contract.
     * @param pool_ The address of the pool to fetch the external bribe for.
     * @return externalBribe The address of the associated external bribe contract.
     *
     * Reverts if:
     * - No gauge is found for the given pool.
     * - The gauge is alive (not a finalized state required for bribing).
     * - No external bribe contract is found.
     */
    function _getExternalBribe(address pool_) internal view returns (address) {
        IVoter voterCache = IVoter(voter);
        address gauge = voterCache.poolToGauge(pool_);

        if (gauge == address(0)) {
            revert InvalidPool(pool_);
        }
        if (!voterCache.isAlive(gauge)) {
            revert InvalidPool(pool_);
        }

        address externalBribe = voterCache.getGaugeState(gauge).externalBribe;

        if (externalBribe == address(0)) {
            revert InvalidBribe(externalBribe);
        }

        return externalBribe;
    }
}
