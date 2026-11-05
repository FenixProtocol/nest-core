// SPDX-License-Identifier: MIT
pragma solidity =0.8.19;

/** @notice Admin managed reward allocations and signed claims for multiple ERC-20 tokens. */
interface ILPRewarder {
    event NotifyReward(address indexed caller, address indexed token, address indexed user, uint256 amount);
    event Claim(address indexed token, address indexed user, uint256 reward, uint256 totalAmount, bytes32 identifier);
    event SetSigner(address indexed signer);

    function setSigner(address signer_) external;

    function notifyReward(address token_, address user_, uint256 amount_) external;

    function notifyRewardWithTransfer(address token_, address user_, uint256 amount_) external;

    function claim(
        address token_,
        uint256 totalAmount_,
        uint256 deadline_,
        bytes32 identifier_,
        bytes calldata signature_
    ) external returns (uint256 reward);

    function claimFor(
        address token_,
        address user_,
        uint256 totalAmount_,
        uint256 deadline_,
        bytes32 identifier_,
        bytes calldata signature_
    ) external returns (uint256 reward);

    function signer() external view returns (address);

    function totalRewards(address token_, address user_) external view returns (uint256);

    function claimed(address token_, address user_) external view returns (uint256);

    function totalRewardDistributed(address token_) external view returns (uint256);

    function totalRewardClaimed(address token_) external view returns (uint256);
}
