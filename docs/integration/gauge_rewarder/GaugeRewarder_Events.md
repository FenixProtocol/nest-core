# GaugeRewarder Events Documentation

Below are the events emitted by the `GaugeRewarder` contract, including detailed descriptions, when they are emitted, and their respective signatures with NatSpec.

```solidity
/**
 * @dev Emitted when rewards are notified for a gauge.
 * @param caller The address that triggered the reward notification.
 * @param gauge The address of the gauge receiving the reward.
 * @param epoch The current epoch of the minter.
 * @param amount The amount of reward tokens notified.
 */
event NotifyReward(address indexed caller, address indexed gauge, uint256 indexed epoch, uint256 amount);
```

- **When Emitted**: This event is emitted when rewards are notified for a specific gauge, either through `notifyReward` or `notifyRewardWithTransfer` functions.

```solidity
/**
 * @dev Emitted by claim overloads that do not include a backend tracking identifier.
 * @param target The address of the recipient of the claimed reward.
 * @param reward The amount of reward claimed.
 * @param totalAmount The user's cumulative reward entitlement across all claim overloads.
 */
event Claim(address target, uint256 reward, uint256 totalAmount);
```

- **When Emitted**: This event is emitted by the `claim` and `claimFor` overloads that do not accept an `identifier`.

```solidity
/**
 * @dev Emitted by claim overloads that include a backend tracking identifier.
 * @param target The address of the recipient of the claimed reward.
 * @param reward The amount of reward claimed.
 * @param totalAmount The user's cumulative reward entitlement across all claim overloads.
 * @param identifier The backend tracking identifier included in the signed claim.
 */
event PositionClaim(address target, uint256 reward, uint256 totalAmount, bytes32 identifier);
```

- **When Emitted**: This event is emitted by the `claim` and `claimFor` overloads that accept an `identifier`. The identifier is backend tracking metadata and does not change claim accounting. These overloads do not also emit `Claim`, so indexers calculating all payouts must process both event types.

```solidity
/**
 * @dev Emitted when the signer address is set.
 * @param signer The address of the new signer.
 */
event SetSigner(address indexed signer);
```

- **When Emitted**: This event is emitted when the signer address is updated by calling the `setSigner` function.
