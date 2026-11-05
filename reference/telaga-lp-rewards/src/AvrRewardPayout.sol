// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract AvrRewardPayout is Ownable2Step, ReentrancyGuard, EIP712 {
    using SafeERC20 for IERC20;

    bytes32 private constant CLAIM_TYPEHASH = keccak256("Claim(address user,uint256 totalAmount,uint256 deadline)");

    IERC20 public immutable token;
    address public signer;                       // zero pauses claims
    uint256 public totalFunded;
    uint256 public totalRewardClaimed;
    mapping(address user => uint256 amount) public claimed;

    event Funded(address indexed funder, uint256 received, uint256 totalFunded);
    event Claim(address target, uint256 reward, uint256 totalAmount);   // same as GaugeRewarder
    event SignerChanged(address indexed previousSigner, address indexed newSigner);

    error AddressZero(); error ZeroAmount(); error ClaimDisabled(); error SignatureExpired();
    error AlreadyClaimed(); error InvalidSignature(); error InsufficientFunding(); error RenounceDisabled();

    constructor(IERC20 token_, address owner_, address signer_) Ownable(owner_) EIP712("GaugeRewarder", "1") {
        if (address(token_) == address(0) || address(token_).code.length == 0) revert AddressZero();
        token = token_;
        signer = signer_;
        emit SignerChanged(address(0), signer_);
    }

    function fund(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        uint256 before = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = token.balanceOf(address(this)) - before;
        if (received == 0) revert ZeroAmount();
        totalFunded += received;
        emit Funded(msg.sender, received, totalFunded);
    }

    function claim(uint256 totalAmount, uint256 deadline, bytes calldata signature)
        external nonReentrant returns (uint256 reward)
    {
        if (signer == address(0)) revert ClaimDisabled();
        if (deadline <= block.timestamp) revert SignatureExpired();
        uint256 already = claimed[msg.sender];
        if (totalAmount <= already) revert AlreadyClaimed();
        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(CLAIM_TYPEHASH, msg.sender, totalAmount, deadline)));
        if (ECDSA.recover(digest, signature) != signer) revert InvalidSignature();
        reward = totalAmount - already;
        if (reward > totalFunded - totalRewardClaimed) revert InsufficientFunding();
        claimed[msg.sender] = totalAmount;
        totalRewardClaimed += reward;
        token.safeTransfer(msg.sender, reward);
        emit Claim(msg.sender, reward, totalAmount);
    }

    function setSigner(address next) external onlyOwner {
        emit SignerChanged(signer, next);
        signer = next;
    }

    function renounceOwnership() public pure override { revert RenounceDisabled(); }
}
