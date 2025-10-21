// SPDX-License-Identifier: MIT
pragma solidity =0.8.19;

import {Ownable2StepUpgradeable} from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {ITokenPublicRaise} from "./interfaces/ITokenPublicRaise.sol";

/**
 * @title TokenPublicRaiseUpgradeable
 * @notice Fixed-rate public raise that accepts native currency and accounts purchased token amounts per depositor.
 * @dev
 * - Price is expressed as `tokenPricePerOneNative` = tokens per 1e18 native units (wei).
 *   Example: if 1 ETH buys 1,000 tokens with 18 decimals, set `tokenPricePerOneNative = 1000e18`.
 * - Enforces a global cap (`totalDepositCap`) and a per-user cap (`maxDepositAmount`).
 * - Tracks per-user deposited native value (`userDeposited`) and purchased tokens (`userTokensAllocated`).
 * - Uses {Ownable2StepUpgradeable} for admin operations and {ReentrancyGuardUpgradeable} to protect deposit paths.
 *
 * Upgradeability:
 * - The implementation constructor disables initializers. Use {initialize} once on the proxy.
 */
contract TokenPublicRaiseUpgradeable is ITokenPublicRaise, Ownable2StepUpgradeable, ReentrancyGuardUpgradeable {
    /**
     * @notice Destination address to receive collected native funds.
     */
    address public treasury;

    /**
     * @notice Inclusive sale start timestamp.
     */
    uint256 public startTimestamp;

    /**
     * @notice Inclusive sale end timestamp.
     */
    uint256 public endTimestamp;

    /**
     * @notice Suggested minimum amount per deposit transaction (native units).
     */
    uint256 public minDepositAmount;

    /**
     * @notice Maximum total amount a single user is allowed to deposit (native units).
     */
    uint256 public maxDepositAmount;

    /**
     * @notice Global cap for all deposits combined (native units).
     */
    uint256 public totalDepositCap;

    /**
     * @notice Price: number of sale tokens received per 1e18 units of native currency.
     * @dev tokensOut = `msg.value * tokenPricePerOneNative / 1e18`.
     */
    uint256 public tokenPricePerOneNative;

    /**
     * @notice Total native currency deposited into the raise so far.
     */
    uint256 public totalDeposited;

    /**
     * @notice Per-user native currency deposited into the raise.
     */
    mapping(address user => uint256) public userDeposited;

    /**
     * @notice Per-user amount of tokens accounted as purchased.
     * @dev This contract only accounts purchases; it does not transfer sale tokens.
     */
    mapping(address user => uint256) public userTokensAllocated;

    /** 
     * @dev Reverts when `msg.value` is below the minimum accepted amount for a context.
     */
    error DepositBelowMin();

    /**
     * @dev Reverts when a user attempts to exceed the per-user cap.
     */
    error DepositAboveMax();

    /**
     * @dev Reverts when the attempted deposit would exceed the global cap.
     */
    error DepositCapReached();

    /**
     * @dev Reverts on zero amount where non-zero is required.
     */
    error AmountZero();

    /**
     * @dev Reverts on zero address where non-zero is required.
     */
    error AddressZero();

    /**
     * @dev Reverts if the raise is not currently active (not started or already finished).
     */
    error RaiseNotActive();

    /**
     * @dev Reverts if timestamps are invalid (e.g., end <= start).
     */
    error InvalidRaiseWindow();

    /**
     * @dev Reverts if provided limit values are inconsistent (e.g., min > max).
     */
    error InvalidDepositLimits();

    /**
     * @dev Reverts if a withdrawal is attempted before the raise has ended.
     */
    error RaiseNotEnded();

    /**
     * @dev Reverts if native currency transfer via call failed.
     */
    error NativeTransferFailed();

    /**
     * @dev Disable initializers on the implementation instance.
     */
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializes the raise configuration.
     * @dev Callable once on the proxy. Emits {ExchangeRateUpdated}, {TreasuryUpdated},
     *      {DepositLimitsUpdated}, and {RaiseWindowUpdated}.
     * @param startTimestamp_ Inclusive sale start timestamp.
     * @param endTimestamp_ Inclusive sale end timestamp.
     * @param minDepositAmount_ Suggested minimum per-user deposit (native units).
     * @param maxDepositAmount_ Maximum per-user total deposit (native units).
     * @param totalDepositCap_ Global cap across all users (native units).
     * @param tokenPricePerOneNative_ Tokens per 1e18 native units.
     * @param treasury_ Destination address for collected native funds.
     */
    function initialize(uint256 startTimestamp_, uint256 endTimestamp_, uint256 minDepositAmount_, uint256 maxDepositAmount_, uint256 totalDepositCap_, uint256 tokenPricePerOneNative_, address treasury_) external initializer {
        _revertIfZero(tokenPricePerOneNative_);

        __Ownable_init();
        __Ownable2Step_init();
        __ReentrancyGuard_init();

        _setTreasury(treasury_);
        _setDepositLimits(minDepositAmount_, maxDepositAmount_, totalDepositCap_);
        _setRaiseWindow(startTimestamp_, endTimestamp_);

        tokenPricePerOneNative = tokenPricePerOneNative_;
        emit ExchangeRateUpdated(tokenPricePerOneNative_);
    }

    /**
     * @notice Deposits native currency into the raise at the current fixed price.
     * @dev
     * - Reverts if the raise is inactive.
     * - Caps the accepted amount by both global and per-user remaining allowances.
     * - Accounts purchased tokens using `tokenPricePerOneNative`.
     * - Emits {Deposited}.
     */
    function deposit() payable external nonReentrant {
        _deposit();
    }

    /**
     * @notice Fallback deposit path to accept plain native transfers during the active window.
     * @dev Mirrors {deposit}. Emits {Deposited}.
     */
    receive() external payable nonReentrant {
        _deposit();
    }

    /**
     * @notice Withdraws the entire native balance to the treasury after the raise has ended.
     * @dev
     * - Only callable by the owner.
     * - Reverts if `block.timestamp <= endTimestamp` (raise not finished yet).
     * - Reverts if there is no balance to withdraw.
     * - Uses checks-effects-interactions and {nonReentrant}.
     * - Emits {TreasuryWithdrawn}.
     */
    function withdrawToTreasury() external onlyOwner nonReentrant {
        if (block.timestamp <= endTimestamp) revert RaiseNotEnded();

        uint256 amount = address(this).balance;
        _revertIfZero(amount);

        (bool ok, ) = payable(treasury).call{value: amount}("");
        if (!ok) revert NativeTransferFailed();

        emit TreasuryWithdrawn(treasury, amount);
    }

    /**
     * @notice Updates the treasury address.
     * @dev Only callable by the owner. Emits {TreasuryUpdated}.
     * @param treasury_ The new treasury address.
     */
    function setTreasury(address treasury_) external onlyOwner {
        _setTreasury(treasury_);
    }

    /**
     * @notice Updates min/per-user/global deposit limits.
     * @dev Only callable by the owner. Emits {DepositLimitsUpdated}.
     * @param minDepositAmount_ Suggested minimum per-tx deposit (native units).
     * @param maxDepositAmount_ Maximum per-user total deposit (native units).
     * @param totalDepositCap_ Global cap across all users (native units).
     */
    function setDepositLimits(uint256 minDepositAmount_, uint256 maxDepositAmount_, uint256 totalDepositCap_) external onlyOwner {
        _setDepositLimits(minDepositAmount_, maxDepositAmount_, totalDepositCap_);
    }

    /**
     * @notice Updates the start/end timestamps of the raise window.
     * @dev Only callable by the owner. Emits {RaiseWindowUpdated}.
     * @param startTimestamp_ Inclusive sale start timestamp.
     * @param endTimestamp_ Inclusive sale end timestamp.
     */
    function setRaiseWindow(uint256 startTimestamp_, uint256 endTimestamp_) external onlyOwner {
        _setRaiseWindow(startTimestamp_, endTimestamp_);
    }

    /**
     * @notice Returns the maximum additional native amount `user_` can still deposit.
     * @dev
     * - If the raise is inactive, returns 0.
     * - Computed as `min(globalRemaining, perUserRemaining)`.
     * - Uses saturating logic for `globalRemaining` and `perUserRemaining`.
     * @param user_ The user address to query.
     * @return maxAllowed The maximum additional deposit amount in native units.
     */
    function maxDeposit(address user_) public view returns(uint256 maxAllowed) {
        if (!isRaiseActive()) {
            return 0;
        }

        uint256 globalRemaining = totalDeposited >= totalDepositCap
            ? 0
            : (totalDepositCap - totalDeposited);

        uint256 already = userDeposited[user_];
        uint256 userRemaining = maxDepositAmount > already ? (maxDepositAmount - already) : 0;

        maxAllowed = globalRemaining < userRemaining ? globalRemaining : userRemaining;
    }

    /**
     * @notice Returns whether the raise window is currently active.
     * @dev Active iff `block.timestamp` is within [startTimestamp, endTimestamp].
     */
    function isRaiseActive() public view returns(bool) {
        return block.timestamp >= startTimestamp && block.timestamp <= endTimestamp;
    }

    /**
     * @notice Returns a compact snapshot of global config/state and the user’s counters.
     * @param user_ The user address to query.
     * @return active Whether the raise is active.
     * @return start Start timestamp.
     * @return end End timestamp.
     * @return min Suggested minimum per-tx deposit.
     * @return max Maximum per-user deposit.
     * @return globalCap Global deposit cap.
     * @return price Tokens per 1e18 native units.
     * @return totalIn Total native deposited.
     * @return userIn User’s native deposited.
     * @return userOut User’s accounted purchased tokens.
     * @return userMaxDeposit User's max deposit amount available for deposit
     */
    function getInfo(address user_) external view returns(
        bool active,
        uint256 start,
        uint256 end,
        uint256 min,
        uint256 max,
        uint256 globalCap,
        uint256 price,
        uint256 totalIn,
        uint256 userIn,
        uint256 userOut,
        uint256 userMaxDeposit
    ) {
        active = isRaiseActive();
        start = startTimestamp;
        end = endTimestamp;
        min = minDepositAmount;
        max = maxDepositAmount;
        globalCap = totalDepositCap;
        price = tokenPricePerOneNative;
        totalIn = totalDeposited;
        if(user_ != address(0)) {
            userIn = userDeposited[user_];
            userOut = userTokensAllocated[user_];
            userMaxDeposit = maxDeposit(user_);
        }
    }

    /**
     * @dev Core deposit logic shared by {deposit} and {receive}.
     *      Emits {Deposited}.
     *
     * Reverts:
     * - {RaiseNotActive} if not active.
     * - {DepositCapReached} if global cap is already reached.
     * - {DepositAboveMax} if the sender already reached the per-user cap.
     * - {AmountZero} if the accepted amount or tokens out evaluates to zero.
     */
    function _deposit() internal {
        if(!isRaiseActive()) {
            revert RaiseNotActive();
        }
        uint256 amount = msg.value;
        _revertIfZero(amount);

        uint256 globalRemaining = totalDeposited >= totalDepositCap
            ? 0
            : (totalDepositCap - totalDeposited);

        if (globalRemaining == 0) revert DepositCapReached();

        uint256 maxLimit = maxDeposit(_msgSender());

        if (maxLimit == 0 || amount > maxLimit) revert DepositAboveMax();

        if (amount + userDeposited[_msgSender()] < minDepositAmount) revert DepositBelowMin();

        uint256 tokensOut = amount * tokenPricePerOneNative / 1e18;

        _revertIfZero(tokensOut);

        totalDeposited += amount;
        userDeposited[_msgSender()] += amount;
        userTokensAllocated[_msgSender()] += tokensOut;

        emit Deposited(_msgSender(), amount, tokensOut);
    }

    /**
     * @dev Internal setter for the treasury address.
     *      Emits {TreasuryUpdated}.
     * @param treasury_ Non-zero treasury address.
     */
    function _setTreasury(address treasury_) internal {
        _revertIfZero(treasury_);
        treasury = treasury_;
        emit TreasuryUpdated(treasury_);
    }

    /**
     * @dev Internal setter for deposit limits.
     *      Emits {DepositLimitsUpdated}.
     * @param minDepositAmount_ Suggested minimum per-tx deposit.
     * @param maxDepositAmount_ Maximum per-user deposit.
     * @param totalDepositCap_ Global cap across all users.
     *
     * Reverts:
     * - {AmountZero} if any max or total value is zero (as checked).
     * - {InvalidDepositLimits} if `minDepositAmount_ > maxDepositAmount_`.
     */
    function _setDepositLimits(uint256 minDepositAmount_, uint256 maxDepositAmount_, uint256 totalDepositCap_) internal {
        _revertIfZero(maxDepositAmount_);
        _revertIfZero(totalDepositCap_);

        if(minDepositAmount_ > maxDepositAmount_) revert InvalidDepositLimits();

        minDepositAmount = minDepositAmount_;
        maxDepositAmount = maxDepositAmount_;
        totalDepositCap = totalDepositCap_;

        emit DepositLimitsUpdated(minDepositAmount_, maxDepositAmount_, totalDepositCap_);
    }

    /**
     * @dev Internal setter for start/end timestamps.
     *      Emits {RaiseWindowUpdated}.
     * @param startTimestamp_ Inclusive start timestamp.
     * @param endTimestamp_ Inclusive end timestamp.
     *
     * Reverts:
     * - {AmountZero} if either timestamp is zero.
     * - {InvalidRaiseWindow} if `endTimestamp_ <= startTimestamp_`.
     */
    function _setRaiseWindow(uint256 startTimestamp_, uint256 endTimestamp_) internal {
        _revertIfZero(startTimestamp_);
        _revertIfZero(endTimestamp_);

        if (endTimestamp_ <= startTimestamp_) revert InvalidRaiseWindow();

        startTimestamp = startTimestamp_;
        endTimestamp = endTimestamp_;
        emit RaiseWindowUpdated(startTimestamp_, endTimestamp_);
    }

    /**
     * @dev Reverts if `addr_` is the zero address.
     * @param addr_ Address to check.
     */
    function _revertIfZero(address addr_) internal pure {
        if (addr_ == address(0)) revert AddressZero();
    }
    
    /**
     * @dev Reverts if `amount_` is zero.
     * @param amount_ Amount to check.
     */
    function _revertIfZero(uint256 amount_) internal pure {
        if (amount_ == 0) revert AmountZero();
    }
}