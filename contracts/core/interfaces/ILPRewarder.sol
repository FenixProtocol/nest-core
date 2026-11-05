// SPDX-License-Identifier: MIT
pragma solidity =0.8.19;

/** @notice Signed cumulative claims for multiple ERC-20 tokens. */
interface ILPRewarder {
    event Claim(address indexed token, address indexed user, uint256 reward, uint256 totalAmount, bytes32 identifier);
    event SetSigner(address indexed signer);
    /** @param token The ERC-20 token, or address(0) for the native token. */
    event RecoverToken(address indexed token, uint256 amount);

    function setSigner(address signer_) external;

    /** @notice Recovers an ERC-20 token or native tokens when token_ is address(0). */
    function recoverTokens(address token_, uint256 amount_) external;

    function claim(
        address token_,
        uint256 totalAmount_,
        uint256 deadline_,
        bytes32 identifier_,
        bytes calldata signature_
    ) external returns (uint256 reward);

    function claim(
        address[] calldata tokens_,
        uint256[] calldata totalAmounts_,
        uint256[] calldata deadlines_,
        bytes32[] calldata identifiers_,
        bytes[] calldata signatures_
    ) external returns (uint256[] memory rewards);

    function claimFor(
        address token_,
        address user_,
        uint256 totalAmount_,
        uint256 deadline_,
        bytes32 identifier_,
        bytes calldata signature_
    ) external returns (uint256 reward);

    function claimFor(
        address[] calldata tokens_,
        address user_,
        uint256[] calldata totalAmounts_,
        uint256[] calldata deadlines_,
        bytes32[] calldata identifiers_,
        bytes[] calldata signatures_
    ) external returns (uint256[] memory rewards);

    function signer() external view returns (address);

    function claimed(address token_, address user_) external view returns (uint256);

    function totalRewardClaimed(address token_) external view returns (uint256);
}
