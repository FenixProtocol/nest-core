// SPDX-License-Identifier: MIT
pragma solidity =0.8.19;
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {SafeERC20Upgradeable, IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import {MerkleProofUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/cryptography/MerkleProofUpgradeable.sol";

/**
 * @title WHypeAirdrop
 * @notice Merkle-proof based airdrop contract for WHYPE token distribution.
 * @dev The contract expects the developer/operator to transfer enough WHYPE tokens
 *      to this contract address before users start claiming.
 * @author Aegas
 */
contract WHypeAirdrop is AccessControlUpgradeable, ReentrancyGuardUpgradeable, PausableUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    /// @notice Emitted when a new Merkle root hash is configured.
    /// @param rootHash Newly configured Merkle root.
    event RootHashUpdated(bytes32 rootHash);

    /// @notice Emitted when a user claims tokens.
    /// @param user Recipient account.
    /// @param rootHashAmount Total cumulative amount allocated to the user in the active root.
    /// @param claimedAmount Amount transferred in the current claim call.
    event Claimed(address indexed user, uint256 rootHashAmount, uint256 claimedAmount);

    /// @notice Emitted when admin recovers ERC20 tokens while paused.
    /// @param token Token address that was recovered.
    /// @param recipient Receiver of the recovered tokens.
    /// @param amount Amount of recovered tokens.
    event EmergencyRecovered(address indexed token, address indexed recipient, uint256 amount);

    /// @notice Thrown when one of the provided addresses is zero.
    error ZeroAddress();

    /// @notice Thrown when provided amount is zero.
    error ZeroAmount();

    /// @notice Thrown when a zero Merkle root is provided.
    error ZeroRootHash();

    /// @notice Thrown when Merkle proof validation fails.
    error InvalidMerkleProof();

    /// @notice Thrown when user already claimed full allocated amount.
    error AlreadyClaimed();

    /// @notice Role that can update Merkle root.
    bytes32 public constant ROOT_SETTER_ROLE = keccak256("ROOT_SETTER_ROLE");

    /// @notice WHYPE ERC20 token address used for airdrop payouts.
    address public whype;

    /// @notice Active Merkle root with cumulative user allocations.
    bytes32 public rootHash;

    /// @notice Tracks cumulative amount already claimed by each user.
    mapping(address => uint256) public claimed;

    /// @dev Disables initializers on implementation contract.
    constructor() {
        _disableInitializers();
    }

    /// @notice Initializes access control, reentrancy guard and pausable state.
    /// @dev Grants admin and root-setter roles to initializer caller.
    function initialize(address whype_) external initializer {
        if (whype_ == address(0)) revert ZeroAddress();
        __AccessControl_init();
        __ReentrancyGuard_init();
        __Pausable_init();
        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _grantRole(ROOT_SETTER_ROLE, _msgSender());
        whype = whype_;
    }

    // ADMIN FUNCTIONS

    /// @notice Updates active Merkle root.
    /// @param rootHash_ New Merkle root hash.
    function setRootHash(bytes32 rootHash_) external onlyRole(ROOT_SETTER_ROLE) whenNotPaused {
        if (rootHash_ == bytes32(0)) revert ZeroRootHash();
        rootHash = rootHash_;
        emit RootHashUpdated(rootHash_);
    }

    /// @notice Pauses claiming and root updates.
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /// @notice Unpauses claiming and root updates.
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /// @notice Emergency function to recover ERC20 tokens while paused.
    /// @param token_ Token to recover.
    /// @param recipient_ Recipient of recovered tokens.
    /// @param amount_ Amount to recover.
    function emergencyRecoverERC20(address token_, address recipient_, uint256 amount_) external onlyRole(DEFAULT_ADMIN_ROLE) whenPaused {
        if (token_ == address(0) || recipient_ == address(0)) revert ZeroAddress();
        if (amount_ == 0) revert ZeroAmount();
        IERC20Upgradeable(token_).safeTransfer(recipient_, amount_);
        emit EmergencyRecovered(token_, recipient_, amount_);
    }

    // USER FUNCTIONS

    /// @notice Claims WHYPE using a Merkle proof and cumulative allocation.
    /// @dev `amount_` is cumulative entitlement from the root. The function transfers
    ///      only the delta between `amount_` and already claimed amount.
    /// @param proof Merkle proof for (`addr_`, `amount_`) leaf.
    /// @param addr_ Address to receive WHYPE.
    /// @param amount_ Cumulative allocation for `addr_` in active root.
    function claim(bytes32[] memory proof, address addr_, uint256 amount_) external nonReentrant whenNotPaused {
        if (!MerkleProofUpgradeable.verify(proof, rootHash, keccak256(bytes.concat(keccak256(abi.encode(addr_, amount_))))))
            revert InvalidMerkleProof();
        uint256 claimedAmountCache = claimed[addr_];
        if (claimedAmountCache >= amount_) revert AlreadyClaimed();
        uint256 toTransferAmount = amount_ - claimedAmountCache;
        claimed[addr_] = amount_;
        IERC20Upgradeable(whype).safeTransfer(addr_, toTransferAmount);
        emit Claimed(addr_, amount_, toTransferAmount);
    }
}
