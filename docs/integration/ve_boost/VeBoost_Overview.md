
## VeBoost Overview

### Introduction

The VeBoost system is an integral component of the Fenix ecosystem, designed to enhance user rewards through the boosting of locked NEST tokens. This document provides an overview of the VeBoost system, explaining how it works, how rewards are calculated, and the factors influencing these rewards.

### How the System Works

The VeBoost system operates by allowing users to lock their NEST tokens in the Voting Escrow contract. Users can deposit NEST tokens, either creating a new lock or adding to an existing lock. Depending on certain conditions, these locked tokens can receive a boost, thereby increasing the effective amount of tokens considered for rewards and voting power.

### Conditions for Rewards
Rewards in the VeBoost system are accrued under the following conditions:
1. **The value to be deposited must be greater than 0**
2. **The user locks amount of NEST for more than the minimum amount for applying the system boost**
3. **The user lock NEST for the maximum period**
4. **VeBoost system has enough NEST to boost users locks**

### Rewards Calculation
In the VeBoost system, rewards are calculated **based on the amount of NEST tokens that the user blocks**. Under certain conditions, the system can also provide additional bonuses in the form of other tokens to the user for the blocked NEST. This is how the reward calculation works:

#### Boosting Locked NEST Amount
The amount of NEST tokens a user locks in the Voting Escrow contract can be boosted (added to amount that user will be locked. This boost depends on the user's amount NEST that will be locked and the boost percentage set in the contract.

**Formula for Boost Calculation:**
```math
 BoostedNESTAmount = UserNESTDepositAmount * BoostPercentage
```
The total effective locked amount is then:
```math
 TotalLockedAmount = UserNESTDepositAmount + BoostedNESTAmount
```

**Example:**

If a user deposits 1000 NEST and the boost percentage is 10%, the calculation will be as follows:

1. **Locked NEST Amount**: 1000 NEST
2. **Boost Percentage**: 10%
```math
 BoostedNESTAmount = 1000 * 10\% = 100\ NEST
```
So, the total effective locked amount will be:
```math
 TotalLockedAmount = 100 + 100 = 1100\ NEST
```
This means the user's effective locked amount is now 1100 NEST. These tokens are added to the user's balance and can be withdrawn along with the principal amount after the lock period ends.


#### Reward Distribution with Other Tokens
Apart from the NEST boost, the VeBoost system can also reward users with other tokens. These additional rewards are calculated based on the boosted NEST amount.

**Formula for Other Token Reward Calculation:**
```math
 TokenPercentage = \frac{BoostedNESTAmount * NESTBalanceOfVeBoost}{100\%}
```
```math
 TokenAmount = TokenPercentage * TokenBalanceOfVeBoost
```
**Example:**

1. **User NEST deposit amount**: 1000 NEST
2. **Total NEST Balance**: 5000 NEST (in the contract)
3. **Token A Balance**: 2000 Tokens (in the contract)
4. **Boost Percentage**: 10%

User boost:
```math
 BoostedNESTAmount = \frac{1000 * 10\%} {100\%} = 100\ NEST
```
```math
 TotalLockedAmount = 100 + 100 = 1100\ NEST
```

Additional reward in the Token A

```math
 TokenPercentage = \frac{100\ NEST}{5000\ NEST} * 100\%=2\%
```
```math
 TokenAmount = 2\%* 2000\ TokenA = 40\ TokenA
```

This means the user receives 40 reward Token A in addition to their NEST boost. **These additional tokens are transfer direct to the user's balance**

### VotingEscrow Methods supportings VeBoost System
The veBoost system is integrated into the `VotingEscrowUpgradeableV1_2` & `VotingEscrowUpgradeable` contract, allowing users to enhance their locked NEST tokens through various methods. The following methods support the veBoost system to boost user rewards:
1. **Deposit for Existing Lock (deposit_for):**
```js
    function deposit_for(uint _tokenId, uint _value) external;
```
2. **Create New Lock (create_lock):**
```js
    function create_lock(uint _value, uint _lock_duration) external;
```
2. **Create New Lock For (create_lock_for):**
```js
    function create_lock_for(uint _tokenId, uint _value, address _to) external;
```