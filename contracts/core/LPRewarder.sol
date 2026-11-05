// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.19;

import {AccessControlEnumerableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import {SafeERC20Upgradeable, IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import {EIP712Upgradeable} from "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import {ECDSAUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";
import {ILPRewarder} from "./interfaces/ILPRewarder.sol";

/**
 * @title LPRewarder
 * @notice Distributes rewards in multiple ERC-20 tokens to individual liquidity providers.
 * @dev An authorized signer approves cumulative claim amounts. Tokens must be funded separately.
 * The user receives only the amount not previously claimed.
 */
contract LPRewarder is ILPRewarder, AccessControlEnumerableUpgradeable, EIP712Upgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    bytes32 internal constant _CLAMER_FOR_ROLE = keccak256("CLAMER_FOR_ROLE");
    bytes32 internal constant _CLAIM_TYPEHASH =
        keccak256("Claim(address token,address user,uint256 totalAmount,uint256 deadline,bytes32 identifier)");

    /** @notice The signer authorized to approve cumulative claims. Zero disables claims. */
    address public signer;

    /** @notice Cumulative rewards claimed by a user for a token. */
    mapping(address token => mapping(address user => uint256)) public claimed;

    /** @notice Total rewards paid across users for each token. */
    mapping(address token => uint256) public totalRewardClaimed;

    error SignatureExpired();
    error ClaimDisabled();
    error AlreadyClaimed();
    error InvalidSignature();
    error AddressZero();
    error LengthMismatch();
    error NativeTransferFailed();

    constructor() {
        _disableInitializers();
    }

    /** @notice Initializes the access roles and EIP-712 domain. */
    function initialize() external initializer {
        __EIP712_init("LPRewarder", "1");
        __AccessControlEnumerable_init();
        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());
    }

    /** @notice Sets the signer for reward claims. */
    function setSigner(address signer_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        signer = signer_;
        emit SetSigner(signer_);
    }

    /** @notice Transfers ERC-20 tokens or native tokens (token_ = address(0)) to the admin. */
    function recoverTokens(address token_, uint256 amount_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (token_ == address(0)) {
            (bool success, ) = payable(_msgSender()).call{value: amount_}("");
            if (!success) revert NativeTransferFailed();
        } else {
            IERC20Upgradeable(token_).safeTransfer(_msgSender(), amount_);
        }
        emit RecoverToken(token_, amount_);
    }

    /**
     * @notice Claims an authorized cumulative reward amount for the caller.
     * @param token_ The reward token.
     * @param totalAmount_ The caller's signed cumulative entitlement for this token.
     * @param deadline_ The exclusive expiration timestamp.
     * @param identifier_ A tracking identifier included in the signature and event.
     * @param signature_ An EIP-712 signature from `signer`.
     * @return reward The newly claimed amount.
     */
    function claim(
        address token_,
        uint256 totalAmount_,
        uint256 deadline_,
        bytes32 identifier_,
        bytes calldata signature_
    ) external returns (uint256 reward) {
        return _claim(token_, _msgSender(), totalAmount_, deadline_, identifier_, signature_);
    }

    /** @notice Claims multiple signed cumulative rewards for the caller. */
    function claim(
        address[] calldata tokens_,
        uint256[] calldata totalAmounts_,
        uint256[] calldata deadlines_,
        bytes32[] calldata identifiers_,
        bytes[] calldata signatures_
    ) external returns (uint256[] memory rewards) {
        uint256 length = tokens_.length;
        if (
            length != totalAmounts_.length || length != deadlines_.length || length != identifiers_.length || length != signatures_.length
        ) {
            revert LengthMismatch();
        }

        rewards = new uint256[](length);
        for (uint256 i; i < length; ++i) {
            rewards[i] = _claim(tokens_[i], _msgSender(), totalAmounts_[i], deadlines_[i], identifiers_[i], signatures_[i]);
        }
    }

    /**
     * @notice Claims on behalf of a user who receives the tokens.
     * @dev The caller needs the claim-for role as well as a valid signer authorization.
     * @param token_ The reward token.
     * @param user_ The beneficiary.
     * @param totalAmount_ The user's signed cumulative entitlement for this token.
     * @param deadline_ The exclusive expiration timestamp.
     * @param identifier_ A tracking identifier included in the signature and event.
     * @param signature_ An EIP-712 signature from `signer`.
     * @return reward The newly claimed amount.
     */
    function claimFor(
        address token_,
        address user_,
        uint256 totalAmount_,
        uint256 deadline_,
        bytes32 identifier_,
        bytes calldata signature_
    ) external onlyRole(_CLAMER_FOR_ROLE) returns (uint256 reward) {
        return _claim(token_, user_, totalAmount_, deadline_, identifier_, signature_);
    }

    /** @notice Claims multiple signed cumulative rewards for a user. */
    function claimFor(
        address[] calldata tokens_,
        address user_,
        uint256[] calldata totalAmounts_,
        uint256[] calldata deadlines_,
        bytes32[] calldata identifiers_,
        bytes[] calldata signatures_
    ) external onlyRole(_CLAMER_FOR_ROLE) returns (uint256[] memory rewards) {
        uint256 length = tokens_.length;
        if (
            length != totalAmounts_.length || length != deadlines_.length || length != identifiers_.length || length != signatures_.length
        ) {
            revert LengthMismatch();
        }

        rewards = new uint256[](length);
        for (uint256 i; i < length; ++i) {
            rewards[i] = _claim(tokens_[i], user_, totalAmounts_[i], deadlines_[i], identifiers_[i], signatures_[i]);
        }
    }

    function _claim(
        address token_,
        address user_,
        uint256 totalAmount_,
        uint256 deadline_,
        bytes32 identifier_,
        bytes calldata signature_
    ) internal returns (uint256 reward) {
        _checkAddressZero(token_);
        _checkAddressZero(user_);
        if (signer == address(0)) revert ClaimDisabled();
        if (deadline_ <= block.timestamp) revert SignatureExpired();

        uint256 claimedAmount = claimed[token_][user_];
        if (totalAmount_ <= claimedAmount) revert AlreadyClaimed();

        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(_CLAIM_TYPEHASH, token_, user_, totalAmount_, deadline_, identifier_)));
        if (ECDSAUpgradeable.recover(digest, signature_) != signer) revert InvalidSignature();

        reward = totalAmount_ - claimedAmount;
        claimed[token_][user_] = totalAmount_;
        totalRewardClaimed[token_] += reward;
        IERC20Upgradeable(token_).safeTransfer(user_, reward);
        emit Claim(token_, user_, reward, totalAmount_, identifier_);
    }

    function _checkAddressZero(address addr_) internal pure {
        if (addr_ == address(0)) revert AddressZero();
    }
}
