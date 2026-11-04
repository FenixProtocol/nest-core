// SPDX-License-Identifier: MIT
pragma solidity =0.8.19;

/**
 * @title ILPRewarder
 * @notice Admin managed NEST distribution to liquidity providers through signed cumulative claims.
 */
interface ILPRewarder {
    /** @notice Emitted when an admin allocates NEST for provider claims. */
    event NotifyReward(address indexed caller, uint256 amount);

    /** @notice Emitted for a claim without a tracking identifier. */
    event Claim(address target, uint256 reward, uint256 totalAmount);

    /** @notice Emitted for a claim with a tracking identifier. */
    event PositionClaim(address target, uint256 reward, uint256 totalAmount, bytes32 identifier);

    /** @notice Emitted when the authorized claim signer changes. */
    event SetSigner(address indexed signer);

    function setSigner(address signer_) external;

    /** @notice Allocates NEST already held by this contract; zero allocates the full unallocated balance. */
    function notifyReward(uint256 amount_) external;

    /** @notice Transfers NEST from the admin and allocates it for provider claims. */
    function notifyRewardWithTransfer(uint256 amount_) external;

    function claimFor(address target_, uint256 totalAmount_, uint256 deadline_, bytes memory signature_) external returns (uint256);

    function claimFor(
        address target_,
        uint256 totalAmount_,
        uint256 deadline_,
        bytes32 identifier_,
        bytes memory signature_
    ) external returns (uint256);

    function claim(uint256 totalAmount_, uint256 deadline_, bytes memory signature_) external returns (uint256);

    function claim(uint256 totalAmount_, uint256 deadline_, bytes32 identifier_, bytes memory signature_) external returns (uint256);

    function totalRewardDistributed() external view returns (uint256);

    function totalRewardClaimed() external view returns (uint256);

    function claimed(address user) external view returns (uint256);

    function token() external view returns (address);

    function signer() external view returns (address);
}
