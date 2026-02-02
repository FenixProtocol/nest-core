// SPDX-License-Identifier: MIT
pragma solidity =0.8.19;

import {Ownable2StepUpgradeable} from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import {SafeERC20Upgradeable, IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import {EnumerableSetUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";

import {IVeBoost} from "./interfaces/IVeBoost.sol";
import {IPriceProvider} from "../integration/interfaces/IPriceProvider.sol";

/**
 * @title VeBoostUpgradeable
 * @dev Implements boosting functionality within the Nest ecosystem, allowing users to receive boosts based on locked NEST tokens.
 */
contract VeBoostUpgradeable is IVeBoost, Ownable2StepUpgradeable {
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.AddressSet;
    using SafeERC20Upgradeable for IERC20Upgradeable;

    /**
     * @dev Return precision for boost calculations
     */
    uint256 internal constant _PRECISION = 10_000;

    /**
     * @dev Return precision for token calculations
     */
    uint256 internal constant _NEST_PRECISION = 1e18;

    /**
     * @dev Return maximum locking time in seconds (about 6 months)
     */
    uint256 internal constant _MAX_TIME = 182 * 86400;

    /**
     * @dev Return address of NEST token
     */
    address public nest;

    /**
     * @dev Return address of the Voting Escrow contract for Nest
     */
    address public votingEscrow;

    /**
     * @dev Return address of the price provider contract for USD/NEST conversion
     */
    address public priceProvider;

    /**
     * @dev Return minimum USD amount required for a boost to be considered
     */
    uint256 public minUSDAmount;

    /**
     * @dev Return minimum locking time required for a boost
     */
    uint256 internal _minLockedTime;

    /**
     * @dev Return percentage of NEST boost
     */
    uint256 internal _boostNESTPercentage;

    /**
     * @dev Store set of addresses for reward tokens
     */
    EnumerableSetUpgradeable.AddressSet internal _rewardTokens;

    error AddressZero();
    
    /**
     * @dev Initializes the contract by disabling the initializer of the inherited upgradeable contract.
     */
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializes the VeBoost contract with necessary addresses and settings.
     * @param nest_ Address of the Nest token.
     * @param votingEscrow_ Address of the Voting Escrow contract.
     * @param priceProvider_ Address of the price provider contract.
     * Initializes contract state and sets up necessary approvals.
     */
    function initialize(address nest_, address votingEscrow_, address priceProvider_) external initializer {
        _checkAddressZero(nest_);
        _checkAddressZero(votingEscrow_);
        _checkAddressZero(priceProvider_);

        __Ownable2Step_init();

        nest = nest_;
        votingEscrow = votingEscrow_;
        priceProvider = priceProvider_;

        minUSDAmount = 10e18; // Initialize minimum USD amount for boost eligibility to $10
        _minLockedTime = 182 * 86400; // Initialize minimum locked time to approximately 6 months
        _boostNESTPercentage = 1_000; // Initialize NEST boost percentage to 10%

        IERC20Upgradeable(nest).safeApprove(votingEscrow_, type(uint256).max);
    }

    /**
     * @notice Sets a new address for the NEST to USD price provider.
     * @param priceProvider_ The address of the new price provider.
     * Only the contract owner can call this function.
     */
    function setPriceProvider(address priceProvider_) external onlyOwner {
        _checkAddressZero(priceProvider_);

        priceProvider = priceProvider_;
        emit PriceProvider(priceProvider_);
    }

    /**
     * @notice Sets a new boost percentage for NEST tokens.
     * @param boostNESTPercentage_ The new boost percentage in basis points.
     * Only the contract owner can call this function.
     */
    function setNESTBoostPercentage(uint256 boostNESTPercentage_) external onlyOwner {
        _boostNESTPercentage = boostNESTPercentage_;
        emit NESTBoostPercentage(boostNESTPercentage_);
    }

    /**
     * @notice Sets a new minimum USD amount required to qualify for a boost.
     * @param minUSDAmount_ The new minimum USD amount in the 18 decimals
     * Only the contract owner can call this function.
     */
    function setMinUSDAmount(uint256 minUSDAmount_) external onlyOwner {
        minUSDAmount = minUSDAmount_;
        emit MinUSDAmount(minUSDAmount_);
    }

    /**
     * @notice Sets a new minimum locked time required to qualify for a boost.
     * @param minLockedTime_ The new minimum locked time in seconds.
     * Only the contract owner can call this function. The time cannot exceed the predefined maximum.
     */
    function setMinLockedTime(uint256 minLockedTime_) external onlyOwner {
        if (minLockedTime_ > _MAX_TIME) {
            revert InvalidMinLockedTime();
        }
        _minLockedTime = minLockedTime_;
        emit MinLockedTime(minLockedTime_);
    }

    /**
     * @dev Allows owner to recover tokens
     * @param token_ Address of the token to recover.
     * @param recoverAmount_ Amount of the token to recover.
     */
    function recoverTokens(address token_, uint256 recoverAmount_) external onlyOwner {
        IERC20Upgradeable(token_).safeTransfer(msg.sender, recoverAmount_);
        emit RecoverToken(token_, recoverAmount_);
    }

    /**
     * @dev Adds a new reward token to the list of tokens users can receive as boosts.
     * Can only be called by the contract owner. Emits an `AddRewardToken` event upon success.
     * @param newRewardToken_ The address of the token to be added as a new reward token.
     */
    function addRewardToken(address newRewardToken_) external onlyOwner {
        _checkAddressZero(newRewardToken_);

        if (newRewardToken_ == nest) {
            revert RewardTokenExist();
        }

        if (!_rewardTokens.add(newRewardToken_)) {
            revert RewardTokenExist();
        }

        emit AddRewardToken(newRewardToken_);
    }

    /**
     * @dev Removes a reward token from the list of tokens users can receive as boosts.
     * Can only be called by the contract owner. Emits a `RemoveRewardToken` event upon success.
     * @param rewardToken_ The address of the reward token to be removed.
     */
    function removeRewardToken(address rewardToken_) external onlyOwner {
        if (!_rewardTokens.remove(rewardToken_)) {
            revert RewardTokenNotExist();
        }
        emit RemoveRewardToken(rewardToken_);
    }

    /**
     * @notice Distributes boost rewards to the token owner before executing the NEST boost payment.
     * Requires the caller to be the Voting Escrow contract.
     * @dev This function calculates and distributes reward tokens proportionally based on the paid NEST boost amount.
     * It verifies that the call is made by the Voting Escrow contract, checks if the paid boost amount is within allowed limits,
     * and then proceeds to distribute reward tokens to the boost recipient. The distribution is proportional to the amount of NEST paid
     * for the boost relative to the total NEST balance of this contract, ensuring fairness in reward distribution.
     *
     * @param tokenOwner_ The address of the owner receiving the boost rewards. This is typically the holder of locked NEST tokens.
     * @param tokenId_ The ID of the token receiving the boost. This parameter is not used in the current implementation but is required for interface compliance.
     * @param depositedNESTAmount_ The total amount of NEST tokens deposited by the token owner for the boost. This is used to calculate the eligibility and amount of the boost.
     * @param paidBoostNESTAmount_ The amount of NEST tokens paid by the token owner to achieve the boost. Rewards are distributed based on this amount.
     *
     * Reverts with `AccessDenied` if called by any address other than the Voting Escrow contract.
     * Reverts with `InvalidBoostAmount` if the paid boost amount exceeds the calculated boost amount or the available boost NEST amount.
     */
    function beforeNESTBoostPaid(
        address tokenOwner_,
        uint256 tokenId_,
        uint256 depositedNESTAmount_,
        uint256 paidBoostNESTAmount_
    ) external override {
        if (msg.sender != votingEscrow) {
            revert AccessDenied();
        }

        if (paidBoostNESTAmount_ > calculateBoostNESTAmount(depositedNESTAmount_) || paidBoostNESTAmount_ > getAvailableBoostNESTAmount()) {
            revert InvalidBoostAmount();
        }

        if (paidBoostNESTAmount_ > 0) {
            uint256 nestBoostToBalanceRatio = (paidBoostNESTAmount_ * _NEST_PRECISION) / IERC20Upgradeable(nest).balanceOf(address(this));

            for (uint256 i; i < _rewardTokens.length(); ) {
                IERC20Upgradeable rewardToken = IERC20Upgradeable(_rewardTokens.at(i));
                uint256 rewardTokenBoostAmount = (nestBoostToBalanceRatio * rewardToken.balanceOf(address(this))) / _NEST_PRECISION;

                if (rewardTokenBoostAmount > 0) {
                    rewardToken.safeTransfer(tokenOwner_, rewardTokenBoostAmount);
                    emit RewardSent(address(rewardToken), tokenOwner_, rewardTokenBoostAmount);
                }

                unchecked {
                    i++;
                }
            }
        }
    }

    /**
     * @dev Returns an array of addresses for all reward tokens available.
     * @return An array of addresses of reward tokens.
     */
    function rewardTokens() external view returns (address[] memory) {
        return _rewardTokens.values();
    }

    /**
     * @dev Returns the minimum NEST amount required for receiving a boost.
     * @return The minimum amount of NEST required for a boost.
     */
    function getMinNESTAmountForBoost() external view override returns (uint256) {
        return _getMinNESTAmountForBoost();
    }

    /**
     * @dev Returns the minimum locked time required to qualify for a boost.
     * @return The minimum locked time in seconds.
     */
    function getMinLockedTimeForBoost() external view override returns (uint256) {
        return _minLockedTime;
    }

    /**
     * @dev Returns the current NEST boost percentage.
     * @return The boost percentage.
     */
    function getBoostNESTPercentage() external view returns (uint256) {
        return _boostNESTPercentage;
    }

    /**
     * @dev Returns the available amount of NEST for boosts, considering both balance and allowance.
     * @return The available NEST amount for boosts.
     */
    function getAvailableBoostNESTAmount() public view override returns (uint256) {
        uint256 availableBalance = IERC20Upgradeable(nest).balanceOf(address(this));
        uint256 availableAllowance = IERC20Upgradeable(nest).allowance(address(this), votingEscrow);

        return availableAllowance > availableBalance ? availableBalance : availableAllowance;
    }

    /**
     * @dev Calculates the amount of NEST that can be boosted based on the deposited amount.
     * @param depositedNESTAmount_ The amount of NEST deposited.
     * @return The amount of NEST that will be boosted.
     */
    function calculateBoostNESTAmount(uint256 depositedNESTAmount_) public view override returns (uint256) {
        return depositedNESTAmount_ >= _getMinNESTAmountForBoost() ? (depositedNESTAmount_ * _boostNESTPercentage) / _PRECISION : 0;
    }

    /**
     * @dev Calculates the minimum amount of NEST tokens required for receiving a boost, based on the USD threshold.
     * Utilizes the current NEST to USD price from the specified price provider to convert the minimum USD amount
     * into its equivalent NEST amount. This ensures that the boost mechanism adapts to changes in the NEST token's value,
     * maintaining the intended economic threshold for participation.
     * @return The calculated minimum amount of NEST tokens required for a boost, based on the current NEST to USD price.
     */
    function _getMinNESTAmountForBoost() internal view returns (uint256) {
        return (IPriceProvider(priceProvider).getUsdToNESTPrice() * minUSDAmount) / _NEST_PRECISION;
    }

    /**
     * @dev Checked provided address on zero value, throw AddressZero error in case when addr_ is zero
     *
     * @param addr_ The address which will checked on zero
     */
    function _checkAddressZero(address addr_) internal pure {
        if (addr_ == address(0)) {
            revert AddressZero();
        }
    }

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[50] private __gap;
}
