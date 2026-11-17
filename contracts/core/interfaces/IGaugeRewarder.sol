// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

/**
 * @title IGaugeRewarder
 * @dev Interface for the GaugeRewarder contract.
 */
interface IGaugeRewarder {
    /**
     * @dev Emitted when rewards are notified for a gauge.
     * @param caller The address that triggered the reward notification.
     * @param gauge The address of the gauge receiving the reward.
     * @param epoch The current epoch of the minter.
     * @param amount The amount of reward tokens notified.
     */
    event NotifyReward(address indexed caller, address indexed gauge, uint256 indexed epoch, uint256 amount);

    /**
     * @dev Emitted by claim overloads that do not include a backend tracking identifier.
     * @param target The address of the recipient of the claimed reward.
     * @param reward The amount of reward claimed.
     * @param totalAmount The user's cumulative entitlement across all claim overloads.
     */
    event Claim(address target, uint256 reward, uint256 totalAmount);

    /**
     * @dev Emitted by claim overloads that include a backend tracking identifier; Claim is not also emitted.
     * @param target The address of the recipient of the claimed reward.
     * @param reward The amount of reward claimed.
     * @param totalAmount The user's cumulative entitlement across all claim overloads.
     * @param identifier The backend tracking identifier included in the signed claim.
     */
    event PositionClaim(address target, uint256 reward, uint256 totalAmount, bytes32 identifier);

    /**
     * @dev Emitted when the signer address is set.
     * @param signer The address of the new signer.
     */
    event SetSigner(address indexed signer);

    /**
     * @notice Sets the signer address for reward claims.
     * @param signer_ The address of the new signer.
     */
    function setSigner(address signer_) external;

    /**
     * @notice Notifies a reward for a specified gauge.
     * @param gauge_ The address of the gauge to receive the reward.
     * @param amount_ The amount of reward tokens.
     */
    function notifyReward(address gauge_, uint256 amount_) external;

    /**
     * @notice Transfers tokens and notifies a reward for a specified gauge.
     * @param gauge_ The address of the gauge to receive the reward.
     * @param amount_ The amount of reward tokens.
     */
    function notifyRewardWithTransfer(address gauge_, uint256 amount_) external;

    /**
     * @notice Claims rewards on behalf of a specified target address.
     * @param target_ The address of the recipient of the claimed reward.
     * @param totalAmount_ The user's cumulative reward entitlement across all claim overloads.
     * @param deadline_ The exclusive expiration timestamp; the claim is invalid when block.timestamp >= deadline_.
     * @param signature_ The signature authorizing the claim.
     * @return The amount of reward claimed.
     */
    function claimFor(address target_, uint256 totalAmount_, uint256 deadline_, bytes memory signature_) external returns (uint256);

    /**
     * @notice Claims rewards on behalf of a specified target address with an identifier for backend tracking.
     * @param target_ The address of the recipient of the claimed reward.
     * @param totalAmount_ The user's cumulative reward entitlement across all claim overloads.
     * @param deadline_ The exclusive expiration timestamp; the claim is invalid when block.timestamp >= deadline_.
     * @param identifier_ The backend tracking identifier included in the signature and event.
     * @param signature_ The signature authorizing the claim.
     * @return The amount of reward claimed.
     */
    function claimFor(
        address target_,
        uint256 totalAmount_,
        uint256 deadline_,
        bytes32 identifier_,
        bytes memory signature_
    ) external returns (uint256);

    /**
     * @notice Claims rewards for the caller.
     * @param totalAmount_ The caller's cumulative reward entitlement across all claim overloads.
     * @param deadline_ The exclusive expiration timestamp; the claim is invalid when block.timestamp >= deadline_.
     * @param signature_ The signature authorizing the claim.
     * @return The amount of reward claimed.
     */
    function claim(uint256 totalAmount_, uint256 deadline_, bytes memory signature_) external returns (uint256);

    /**
     * @notice Claims rewards for the caller with an identifier for backend tracking.
     * @param totalAmount_ The caller's cumulative reward entitlement across all claim overloads.
     * @param deadline_ The exclusive expiration timestamp; the claim is invalid when block.timestamp >= deadline_.
     * @param identifier_ The backend tracking identifier included in the signature and event.
     * @param signature_ The signature authorizing the claim.
     * @return The amount of reward claimed.
     */
    function claim(uint256 totalAmount_, uint256 deadline_, bytes32 identifier_, bytes memory signature_) external returns (uint256);

    /**
     * @notice Gets the total reward distributed so far.
     * @return The total amount of rewards distributed.
     */
    function totalRewardDistributed() external view returns (uint256);

    /**
     * @notice Gets the total reward claimed so far.
     * @return The total amount of rewards claimed.
     */
    function totalRewardClaimed() external view returns (uint256);

    /**
     * @notice Gets the cumulative amount claimed by an address across all claim overloads.
     * @param user The address of the user.
     * @return The amount of rewards claimed by the user.
     */
    function claimed(address user) external view returns (uint256);

    /**
     * @notice Gets the address of the reward token.
     * @return The address of the reward token.
     */
    function token() external view returns (address);

    /**
     * @notice Gets the address of the minter contract.
     * @return The address of the minter contract.
     */
    function minter() external view returns (address);

    /**
     * @notice Gets the address of the voter contract.
     * @return The address of the voter contract.
     */
    function voter() external view returns (address);

    /**
     * @notice Gets the address of the authorized signer for reward claims.
     * @return The address of the signer.
     */
    function signer() external view returns (address);

    /**
     * @notice Gets the reward amount for a specific gauge and epoch.
     * @param epoch The epoch for which to get the reward.
     * @param gauge The address of the gauge.
     * @return The reward amount for the specified gauge and epoch.
     */
    function rewardPerGaugePerEpoch(uint256 epoch, address gauge) external view returns (uint256);

    /**
     * @notice Gets the total reward amount for a specific epoch.
     * @param epoch The epoch for which to get the reward.
     * @return The total reward amount for the specified epoch.
     */
    function rewardPerEpoch(uint256 epoch) external view returns (uint256);
}
