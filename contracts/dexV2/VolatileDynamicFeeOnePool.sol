// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.19;

import {ICustomVolatileDynamicFee} from "./interfaces/ICustomVolatileDynamicFee.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {IPair} from "./interfaces/IPair.sol";

/**
 * @title VolatileDynamicFeeOnePool
 * @notice Dynamic-fee module for a single pair. The fee starts at `startFeePercentage` (in BPS),
 *         decreases by `decreaseStepBps` after each `decreaseInterval` seconds, and never goes
 *         below `finalFeePercentage` (in BPS).
 *
 * @dev
 * - All fee values use basis points (BPS) with `_PRECISION = 10_000` (100%).
 *   Example: 50% == 5_000, 1% == 100 BPS.
 * - Time values are in seconds.
 * - The module is bound to exactly one pair (`pair`) at initialization.
 * - `startTimestamp` can be provided up-front; if set to 0, it will be lazily initialized
 */
contract VolatileDynamicFeeOnePool is ICustomVolatileDynamicFee, OwnableUpgradeable {
    /**
     * @notice Precision helper (basis points). 100% == 10_000.
     * @dev Not used by default (module uses pp). Available for integrators.
     */
    uint256 internal constant _PRECISION = 10000;

    /**
     * @notice The target pair this fee module is attached to.
     */
    address public pair;

    /**
     * @notice Interval length (in seconds) after which the fee decreases by `decreaseStepBps`.
     */
    uint256 public decreaseInterval;

    /**
     * @notice Fee decrease amount per interval, in BPS (e.g., 100 == 1%).
     */
    uint256 public decreaseStepBps;

    /**
     * @notice Initial fee in BPS (e.g., 5_000 == 50%).
     */
    uint256 public startFeePercentage;

    /**
     * @notice Final (minimum) fee in BPS.
     */
    uint256 public finalFeePercentage;

    /**
     * @notice Start timestamp for the decreasing schedule.
     * @dev If set to 0 during initialization, it must be set later before the schedule becomes active.
     */
    uint256 public startTimestamp;

    /**
     * @notice Emitted when `startTimestamp` is updated.
     * @param startTimestamp The new schedule start timestamp.
     */
    event SetStartTimestamp(uint256 startTimestamp);

    /**
     * @dev Thrown when a provided address is the zero address.
     */
    error AddressZero();

    /**
     * @dev Thrown when a caller is not authorized to execute the function.
     */
    error InvalidCaller();

    /**
     * @dev Thrown when a function is called for a pair that does not match the configured `pair`.
     */
    error InvalidExpectPair();

    /**
     * @dev Thrown when provided configuration parameters are invalid.
     *      Examples:
     *        - `startFeePercentage < finalFeePercentage`
     *        - `decreaseInterval == 0`
     *        - `decreaseStepBps == 0`
     *        - any fee exceeds `_PRECISION`.
     */
    error InvalidConfiguration();

    /**
     * @dev Ensures the function is called strictly for the configured `pair`.
     *      Reverts with {InvalidExpectPair} if `pair_` does not match.
     * @param pair_ The pair address expected to match the configured `pair`.
     */
    modifier onlyForOnePair(address pair_) {
        if (pair != pair_) {
            revert InvalidExpectPair();
        }
        _;
    }

    /**
     * @notice Disables initializers on implementation to protect upgradeable pattern.
     */
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializes the module for a specific pair with a configurable decreasing fee schedule.
     *
     * @dev Requirements:
     * - `pair_` must be non-zero.
     * - `startFeePercentage_` and `finalFeePercentage_` must be within `[0, _PRECISION]`.
     * - `startFeePercentage_ > finalFeePercentage_`.
     * - `decreaseInterval_ > 0`.
     * - `decreaseStepBps_ > 0` and `decreaseStepBps_ <= _PRECISION`.
     *
     * Emits no events.
     *
     * @param pair_ The pair address this module controls.
     * @param startTimestamp_ Schedule start timestamp (may be 0 to defer activation).
     * @param startFeePercentage_ Initial fee in BPS (e.g., 5_000 == 50%).
     * @param finalFeePercentage_ Minimal fee in BPS (lower bound).
     * @param decreaseInterval_ Interval length in seconds for each decrease step.
     * @param decreaseStepBps_ Fee decrease per interval in BPS (e.g., 100 == 1%).
     */
    function initialize(
        address pair_,
        uint256 startTimestamp_,
        uint256 startFeePercentage_,
        uint256 finalFeePercentage_,
        uint256 decreaseInterval_,
        uint256 decreaseStepBps_
    ) external initializer {
        _checkAddressZero(pair_);

        if (startFeePercentage_ > _PRECISION || finalFeePercentage_ > _PRECISION || startFeePercentage_ <= finalFeePercentage_) {
            revert InvalidConfiguration();
        }

        if (decreaseInterval_ == 0 || decreaseStepBps_ == 0 || decreaseStepBps_ > _PRECISION) {
            revert InvalidConfiguration();
        }

        __Ownable_init();

        pair = pair_;
        startTimestamp = startTimestamp_;
        startFeePercentage = startFeePercentage_;
        finalFeePercentage = finalFeePercentage_;
        decreaseInterval = decreaseInterval_;
        decreaseStepBps = decreaseStepBps_;
    }

    /**
     * @notice Updates the schedule start timestamp.
     *
     * @dev Requirements:
     * - Caller must be the owner.
     *
     * Emits a {SetStartTimestamp} event.
     *
     * @param startTimestamp_ The new start timestamp for the schedule.
     */
    function setStartTimestamp(uint256 startTimestamp_) external onlyOwner {
        startTimestamp = startTimestamp_;
        emit SetStartTimestamp(startTimestamp_);
    }

    /**
     * @notice Returns whether the module is considered enabled.
     * @dev Current implementation returns `true` unconditionally.
     * Integrators that require strict activation gates should implement additional checks.
     * @return isEnable_ Always `true`.
     */
    function isEnable() public pure override returns (bool isEnable_) {
        return true;
    }

    /**
     * @notice Returns the current fee for the configured pair.
     * @dev If not active (see {isEnable}), returns `(false, 0)`. Otherwise returns `(true, feeBps)`.
     *
     * Requirements:
     * - `pair_` must match the configured `pair`. (See {onlyForOnePair})
     *
     * @param pair_ The pair address (must equal the configured `pair`).
     * @return success True if the module is active and a fee is provided.
     * @return fee The current fee in BPS (e.g., 5_000 == 50%).
     */
    function getFee(address pair_) external view override onlyForOnePair(pair_) returns (bool success, uint256 fee) {
        if (!isEnable()) {
            return (false, 0);
        }
        success = true;
        fee = calculate(block.timestamp, startTimestamp, startFeePercentage, finalFeePercentage, decreaseInterval, decreaseStepBps);
    }

    /**
     * @notice Pure helper to compute the fee (in BPS) for an arbitrary timestamp.
     * @dev
     * - If `currentTimestamp_ <= startTimestamp_` (or `startTimestamp_ == 0`) the function returns `startFeePercentage_`.
     * - For each full `decreaseInterval_` elapsed after the start, the fee is reduced by `decreaseStepBps_`.
     * - The result is clamped at `finalFeePercentage_`.
     * - Uses ceil-division for the clamp threshold to avoid intermediate multiplication overflow:
     *   `stepsToMin = ceil((start - final) / step) = (delta + step - 1) / step`.
     *
     * @param currentTimestamp_ The timestamp to evaluate the fee for.
     * @param startTimestamp_ The start of the decreasing schedule.
     * @param startFeePercentage_ Initial fee in BPS at schedule start.
     * @param finalFeePercentage_ Minimal fee in BPS (clamp lower bound).
     * @param decreaseInterval_ Interval length in seconds for each decrease.
     * @param decreaseStepBps_ Fee decrease per interval in BPS.
     * @return fee The computed fee in BPS for `currentTimestamp_`.
     */
    function calculate(
        uint256 currentTimestamp_,
        uint256 startTimestamp_,
        uint256 startFeePercentage_,
        uint256 finalFeePercentage_,
        uint256 decreaseInterval_,
        uint256 decreaseStepBps_
    ) public pure returns (uint256 fee) {
        if (startTimestamp_ == 0 || currentTimestamp_ <= startTimestamp_) {
            return startFeePercentage_;
        }

        uint256 elapsed = currentTimestamp_ - startTimestamp_;
        uint256 steps = elapsed / decreaseInterval_;

        uint256 deltaBps = startFeePercentage_ - finalFeePercentage_;

        uint256 stepsToMin = deltaBps == 0 ? 0 : (deltaBps + decreaseStepBps_ - 1) / decreaseStepBps_;

        if (steps >= stepsToMin) {
            return finalFeePercentage_;
        }

        return startFeePercentage_ - steps * decreaseStepBps_;
    }

    /**
     * @dev Checked provided address on zero value, throw AddressZero error in case when addr_ is zero
     *
     * @param addr_ The address which will checked on zero
     */
    function _checkAddressZero(address addr_) internal pure virtual {
        if (addr_ == address(0)) {
            revert AddressZero();
        }
    }
}
