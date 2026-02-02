// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

/**
 * @title Interface for the VeNestDistributor Contract
 * @notice This interface outlines the methods and events for distributing veNest tokens via an airdrop mechanism.
 * @dev The contract locks NEST tokens in the Voting Escrow to create veNest on behalf of recipients.
 */
interface IVeNestDistributor {
    /**
     * @notice Struct containing the details required to airdrop NEST and create veNest.
     * @param recipient The address that will receive the newly created veNest tokens.
     * @param withPermanentLock Specifies if the created veNest position should be permanently locked.
     * @param lockDuration The duration (in seconds) for which the NEST tokens will be locked for veNest.
     * @param amount The amount of NEST tokens to be locked, which in turn mints veNest.
     * @param managedTokenIdForAttach The managed token ID to which veNest is attached, if applicable.
     */
    struct AirdropRow {
        address recipient;
        bool withPermanentLock;
        uint256 lockDuration;
        uint256 amount;
        uint256 managedTokenIdForAttach;
    }

    /**
     * @notice Emitted when whitelisting statuses for multiple reasons are set.
     * @param reasons An array of string descriptions used as "reasons" for an airdrop.
     * @param isWhitelisted A corresponding array of boolean values indicating whether each reason is whitelisted.
     */
    event SetWhitelistReasons(string[] reasons, bool[] isWhitelisted);

    /**
     * @notice Emitted after a successful airdrop operation to multiple recipients.
     * @param caller The address that initiated the airdrop distribution.
     * @param reason A whitelisted reason describing the purpose of this airdrop.
     * @param totalDistributionSum The total amount of NEST tokens distributed (locked) across all recipients in this batch.
     */
    event AidropVeNestTotal(address indexed caller, string reason, uint256 totalDistributionSum);

    /**
     * @notice Emitted after a single recipient successfully receives veNest.
     * @param recipient The address receiving the newly created veNest tokens.
     * @param reason A whitelisted reason describing the purpose of this airdrop.
     * @param tokenId The ID of the veNest token created for the recipient.
     * @param amount The amount of NEST tokens locked on behalf of the recipient.
     */
    event AirdropVeNest(address indexed recipient, string reason, uint256 tokenId, uint256 amount);

    /**
     * @notice Emitted when tokens are recovered by an authorized role (e.g., owner).
     * @param token The address of the token that was recovered.
     * @param recoverAmount The amount of tokens recovered.
     */
    event RecoverToken(address indexed token, uint256 indexed recoverAmount);

    /**
     * @notice Checks if a given reason is whitelisted.
     * @param reason_ The reason string to verify.
     * @return True if the reason is whitelisted, false otherwise.
     */
    function isWhitelistedReason(string memory reason_) external view returns (bool);

    /**
     * @notice Updates the whitelisting status of multiple airdrop reasons.
     * @param reasons_ An array of reasons to set or unset from the whitelist.
     * @param isWhitelisted_ A matching array of booleans indicating whether each reason is whitelisted.
     * @dev Emitted via {SetWhitelistReasons}.
     */
    function setWhitelistReasons(string[] calldata reasons_, bool[] calldata isWhitelisted_) external;

    /**
     * @notice Allows the holder of `_WITHDRAWER_ROLE` to recover tokens from this contract.
     * @dev
     *  - This can be used to retrieve any ERC20 token that was mistakenly sent to this contract.
     * @param token_ The address of the token to recover.
     * @param recoverAmount_ The amount of tokens to recover.
     * @custom:emits RecoverToken
     */
    function recoverTokens(address token_, uint256 recoverAmount_) external;

    /**
     * @notice Distributes veNest tokens to specified recipients by locking NEST tokens in the Voting Escrow contract.
     * @dev
     *  - Requires the caller to have the `_DISTRIBUTOR_ROLE`.
     *  - Verifies that `reason_` is whitelisted. If not, reverts with {NotWhitelistedReason}.
     *  - Calculates the total sum of NEST tokens needed. If the contract does not have enough, reverts with {InsufficientBalance}.
     *  - Locks NEST in the Voting Escrow for each recipient, creating veNest positions.
     *  - Emits {AirdropVeNestTotal} after distributing to all recipients in this batch.
     *  - Emits {AirdropVeNest} for each individual recipient.
     * @param reason_ A whitelisted string describing the airdrop reason.
     * @param rows_ An array of AirdropRow structs that specify each recipient, lock duration, amount, etc.
     */
    function distributeVeNest(string memory reason_, AirdropRow[] calldata rows_) external;
}
