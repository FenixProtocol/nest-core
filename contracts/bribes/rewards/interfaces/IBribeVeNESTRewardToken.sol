// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

/**
 * @title IBribeVeNESTRewardToken
 * @notice This interface defines the methods and data structures for a token
 *   that represents an intermediate step in the conversion process of
 *   NEST to veNEST. It allows for minting "bribe"-like tokens, which upon
 *   transfer to non-whitelisted addresses, are converted into veNEST locks.
 */
interface IBribeVeNESTRewardToken is IERC20Upgradeable {
    /**
     * @notice Parameters for creating a veNEST lock in the VotingEscrow contract.
     * @param lockDuration The duration (in seconds) for which the NEST will be locked.
     * @param shouldBoosted Whether the newly created veNEST position should be boosted.
     * @param withPermanentLock If true, the created lock becomes permanent and cannot be unlocked.
     * @param managedTokenIdForAttach If non-zero, attaches the newly created veNEST position to a managed token ID.
     */
    struct CreateLockParams {
        uint256 lockDuration;
        bool shouldBoosted;
        bool withPermanentLock;
        uint256 managedTokenIdForAttach;
    }

    /**
     * @dev Emitted when the parameters for creating veNEST locks are updated.
     * @param createLockParams The new parameters for creating veNEST locks.
     */
    event UpdateCreateLockParams(CreateLockParams createLockParams);

    /**
     * @notice Returns the role identifier for entities allowed to mint the intermediate bribe tokens.
     * @return A bytes32 value representing the MINTER_ROLE identifier.
     */
    function MINTER_ROLE() external view returns (bytes32);

    /**
     * @notice Returns the role identifier for entities that should not trigger
     *         automatic conversion of tokens into veNEST upon receiving them.
     * @return A bytes32 value representing the WHITELIST_ROLE identifier.
     */
    function WHITELIST_ROLE() external view returns (bytes32);

    /**
     * @notice Returns the address of the VotingEscrow contract that is used for creating veNEST locks.
     * @return The address of the VotingEscrow contract.
     */
    function votingEscrow() external view returns (address);

    /**
     * @notice Returns the address of the underlying NEST token that will be locked to create veNEST positions.
     * @return The address of the underlying NEST token.
     */
    function underlyingToken() external view returns (address);

    /**
     * @notice Returns the parameters currently set for creating new veNEST locks.
     *         These parameters are used when converting the intermediary tokens
     *         into veNEST by calling the VotingEscrow contract.
     * @return lockDuration The duration (in seconds) for which the NEST will be locked.
     * @return shouldBoosted Whether the newly created veNEST position should be boosted.
     * @return withPermanentLock If true, the created lock becomes permanent and cannot be unlocked.
     * @return managedTokenIdForAttach If non-zero, attaches the newly created veNEST position to a managed token ID.
     */
    function createLockParams()
        external
        view
        returns (uint256 lockDuration, bool shouldBoosted, bool withPermanentLock, uint256 managedTokenIdForAttach);

    /**
     * @notice Updates the parameters used for creating new veNEST locks.
     * @dev Only callable by an address holding the DEFAULT_ADMIN_ROLE.
     *      This function sets new values that dictate how veNEST locks are created when
     *      intermediary tokens are transferred to non-whitelisted addresses.
     * @param createLockParams_ The new parameters specifying lock duration, boosting,
     *                          permanent lock setting, and associated managed token ID.
     *
     * Emits an {UpdateCreateLockParams} event.
     */
    function updateCreateLockParams(CreateLockParams memory createLockParams_) external;

    /**
     * @notice Mints a specified amount of bribe-like tokens (intermediary tokens)
     *         in exchange for NEST tokens transferred to this contract.
     *         Only accounts with the MINTER_ROLE can call this function.
     * @dev The NEST tokens must be transferred before or during the call.
     *      The contract will hold these NEST tokens until they are eventually
     *      converted into veNEST locks.
     * @param to_ The address that will receive the newly minted intermediary tokens.
     * @param amount_ The number of tokens to mint, which corresponds to the NEST
     *                amount locked within this contract for future veNEST conversion.
     */
    function mint(address to_, uint256 amount_) external;
}
