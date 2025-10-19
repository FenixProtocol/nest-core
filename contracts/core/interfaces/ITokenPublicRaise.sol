// SPDX-License-Identifier: MIT
pragma solidity =0.8.19;

/**
 * @title ITokenPublicRaise
 * @notice Interface for a fixed-rate public raise that accepts native currency and
 *         accounts purchased token amounts per depositor.
 */
interface ITokenPublicRaise {
    /**
     * @notice Emitted on a successful deposit during the active raise window.
     * @param user      Depositor address.
     * @param amountIn  Accepted native amount in wei (may be capped by per-user/global limits).
     * @param tokensOut Accounted amount of sale tokens purchased for `amountIn`
     *                  using the current fixed exchange rate.
     */
    event Deposited(address indexed user, uint256 amountIn, uint256 tokensOut);

    /**
     * @notice Emitted when the treasury address is updated by the owner.
     * @param newTreasury The new destination address for collected native funds.
     */
    event TreasuryUpdated(address indexed newTreasury);

    /**
     * @notice Emitted when deposit limits are updated by the owner.
     * @param minDepositAmount Suggested minimum per-transaction deposit (native units, wei).
     * @param maxDepositAmount Maximum total native amount a single user may deposit (wei).
     * @param totalDepositCap  Global cap for total native deposits across all users (wei).
     */
    event DepositLimitsUpdated(uint256 minDepositAmount, uint256 maxDepositAmount, uint256 totalDepositCap);

    /**
     * @notice Emitted when the raise window (start/end timestamps) is updated by the owner.
     * @param startTimestamp Inclusive start timestamp.
     * @param endTimestamp   Inclusive end timestamp.
     */
    event RaiseWindowUpdated(uint256 startTimestamp, uint256 endTimestamp);

    /**
     * @notice Emitted when the fixed exchange rate is updated by the owner.
     * @dev The rate is expressed as "tokens per 1e18 native units".
     * @param tokenPricePerOneNative Number of tokens allocated per 1e18 native units (wei).
     */
    event ExchangeRateUpdated(uint256 tokenPricePerOneNative);

    /**
     * @notice Emitted when native funds are withdrawn to the treasury after the raise ends.
     * @param treasury Treasury address that received the funds.
     * @param amount   Amount of native currency (wei) transferred to `treasury`.
     */
    event TreasuryWithdrawn(address indexed treasury, uint256 amount);

    /**
     * @notice Initializes the raise configuration (proxy initializer).
     * @param startTimestamp_          Inclusive sale start timestamp.
     * @param endTimestamp_            Inclusive sale end timestamp.
     * @param minDepositAmount_        Suggested minimum per-transaction deposit (wei).
     * @param maxDepositAmount_        Maximum total native amount per user (wei).
     * @param totalDepositCap_         Global cap across all users (wei).
     * @param tokenPricePerOneNative_  Tokens per 1e18 native units (wei-denominated rate).
     * @param treasury_                Destination address for collected native funds.
     */
    function initialize(
        uint256 startTimestamp_,
        uint256 endTimestamp_,
        uint256 minDepositAmount_,
        uint256 maxDepositAmount_,
        uint256 totalDepositCap_,
        uint256 tokenPricePerOneNative_,
        address treasury_
    ) external;

    /**
     * @notice Deposits native currency during the active raise window at the fixed rate.
     * @dev The effective accepted amount may be capped by per-user and/or global remaining allowances.
     */
    function deposit() external payable;

    /**
     * @notice Withdraws the entire native balance to the treasury after the raise has ended.
     * @dev Only callable by the owner in the implementation.
     */
    function withdrawToTreasury() external;

    /**
     * @notice Updates the treasury address.
     * @param treasury_ New treasury address.
     */
    function setTreasury(address treasury_) external;

    /**
     * @notice Updates min/per-user/global deposit limits.
     * @param minDepositAmount_ Suggested minimum per-transaction deposit (wei).
     * @param maxDepositAmount_ Maximum total native amount per user (wei).
     * @param totalDepositCap_  Global cap across all users (wei).
     */
    function setDepositLimits(
        uint256 minDepositAmount_,
        uint256 maxDepositAmount_,
        uint256 totalDepositCap_
    ) external;

    /**
     * @notice Updates the start/end timestamps of the raise window.
     * @param startTimestamp_ Inclusive start timestamp.
     * @param endTimestamp_   Inclusive end timestamp.
     */
    function setRaiseWindow(uint256 startTimestamp_, uint256 endTimestamp_) external;

    /**
     * @notice Returns the maximum additional native amount `user_` can still deposit (in wei).
     * @param user_ The user address to query.
     * @return maxAllowed Maximum additional deposit permitted for `user_`.
     */
    function maxDeposit(address user_) external view returns (uint256 maxAllowed);

    /**
     * @notice Returns whether the raise window is currently active.
     * @return active True if `block.timestamp` ∈ [startTimestamp, endTimestamp], false otherwise.
     */
    function isRaiseActive() external view returns (bool active);

    /**
     * @notice Returns a snapshot of global config/state and the user’s counters.
     * @param user_ Address to query (use zero address for global-only fields).
     * @return active         Whether the raise is active.
     * @return start          Start timestamp.
     * @return end            End timestamp.
     * @return min            Suggested minimum per-transaction deposit.
     * @return max            Maximum per-user deposit.
     * @return globalCap      Global deposit cap.
     * @return price          Tokens per 1e18 native units.
     * @return totalIn        Total native deposited.
     * @return userIn         User’s native deposited (0 for zero address).
     * @return userOut        User’s accounted purchased tokens (0 for zero address).
     * @return userMaxDeposit User’s remaining allowed deposit (0 for zero address).
     */
    function getInfo(address user_)
        external
        view
        returns (
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
        );
}
