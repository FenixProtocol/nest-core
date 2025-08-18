
# VeBoost View Methods

This document outlines the simple view methods available in the VeBoost contract, what they return, and how to obtain various pieces of information.

## View Methods

### rewardTokens

**Signature:**
```solidity
/**
* @dev Returns an array of addresses for all reward tokens available.
 * @return An array of addresses of reward tokens.
*/
function rewardTokens() external view returns (address[] memory);
```

**Description:**
Returns an array of addresses for all reward tokens available in the VeBoost system.

**Returns:**
- An array of addresses of reward tokens.

### getMinNESTAmountForBoost

**Signature:**
```solidity
/**
* @dev Returns the minimum NEST amount required for receiving a boost.
* @return The minimum amount of NEST required for a boost.
*/
function getMinNESTAmountForBoost() external view returns (uint256);
```

**Description:**
Returns the minimum NEST amount required for receiving a boost.

**Returns:**
- The minimum amount of NEST required for a boost.

### getMinLockedTimeForBoost

**Signature:**
```solidity
/**
* @dev Returns the current NEST boost percentage.
* @return The boost percentage.
*/
function getMinLockedTimeForBoost() external view returns (uint256);
```

**Description:**
Returns the minimum locked time required to qualify for a boost.

**Returns:**
- The minimum locked time in seconds.

### getBoostNESTPercentage

**Signature:**
```solidity
/**
* @dev Returns the current NEST boost percentage.
* @return The boost percentage.
*/
function getBoostNESTPercentage() external view returns (uint256);
```

**Description:**
Returns the current NEST boost percentage.

**Returns:**
- The boost percentage.

### getAvailableBoostNESTAmount

**Signature:**
```solidity
/**
* @dev Returns the available amount of NEST for boosts, considering both balance and allowance.
* @return The available NEST amount for boosts.
*/
function getAvailableBoostNESTAmount() public view returns (uint256);
```

**Description:**
Returns the available amount of NEST for boosts, considering both balance and allowance.

**Returns:**
- The available NEST amount for boosts.

### calculateBoostNESTAmount

**Signature:**
```solidity
/**
* @dev Calculates the amount of NEST that can be boosted based on the deposited amount.
* @param depositedNESTAmount_ The amount of NEST deposited.
* @return The amount of NEST that will be boosted.
*/
function calculateBoostNESTAmount(uint256 depositedNESTAmount_) public view returns (uint256);
```

**Description:**
Calculates the amount of NEST that can be boosted based on the deposited amount.

**Parameters:**
- `depositedNESTAmount_`: The amount of NEST deposited.

**Returns:**
- The amount of NEST that will be boosted.

## How to Obtain Information

- **List of Reward Tokens:** Call the `rewardTokens` method to get an array of all reward token addresses.
- **Minimum NEST Amount for Boost:** Use the `getMinNESTAmountForBoost` method to retrieve the minimum NEST amount required for a boost.
- **Minimum Locked Time for Boost:** Call the `getMinLockedTimeForBoost` method to get the minimum locked time in seconds.
- **Current NEST Boost Percentage:** Use the `getBoostNESTPercentage` method to find out the current boost percentage.
- **Available NEST for Boosts:** Call the `getAvailableBoostNESTAmount` method to see the available NEST amount for boosts.
- **Calculate Boost NEST Amount:** Use the `calculateBoostNESTAmount` method by providing the deposited NEST amount to calculate the boost amount.

By using these methods, users can easily obtain all necessary information about the VeBoost system and their potential boosts.
