# CustomBribeRewardRouter Integration Guide

## Contract Functions

### `NotifyRewardNESTInVeNest`

#### Function Signature
```solidity
/**
 * @notice Notifies an external bribe contract of NEST-based rewards by converting NEST into brVeNEST tokens.
 * @dev NEST tokens are transferred from the caller to this contract, then converted into brVeNEST tokens,
 *      and finally notified to the external bribe contract associated with the given pool.
 * @param pool_ The address of the pool for which the reward is being distributed.
 * @param amount_ The amount of NEST to convert and distribute as brVeNEST rewards.
 *
 * Emits a {NotifyRewardNESTInVeNest} event.
 * Reverts if the function is disabled or the pool is invalid.
 */
function NotifyRewardNESTInVeNest(address pool_, uint256 amount_) external;
```

#### Description
This function allows a user to:
1. Convert NEST tokens into `brVeNEST`.
2. Notify the external bribe contract for the specified pool about the newly available rewards.

#### Requirements
- **Function Must Be Enabled:** Admin must ensure the function is enabled via `setupFuncEnable`.
- **NEST Approval:** Caller must approve the `CustomBribeRewardRouter` contract to spend the NEST tokens.
- **Valid Pool:** The specified `pool_` must map to a valid external bribe contract via the `voter` contract.

#### Parameters
- `pool_`: Address of the pool for which the rewards are distributed.
- `amount_`: Amount of NEST to be converted into `brVeNEST`.

#### Example Workflow
1. **Approve NEST Tokens:**
   ```solidity
   IERC20Upgradeable(nestToken).approve(customBribeRewardRouter, amount);
   ```
2. **Call Function:**
   ```solidity
   customBribeRewardRouter.notifyRewardNESTInVeNEST(poolAddress, amount);
   ```
3. **Result:**
   - NEST is transferred to the router.
   - NEST is converted into `brVeNEST`.
   - The external bribe contract is notified about the new rewards.

---

### `notifyRewardVeNESTInVeNest`

#### Function Signature
```solidity
/**
 * @notice Notifies an external bribe contract using NEST reclaimed from burning a veNEST NFT.
 * @dev A veNEST NFT is transferred from the caller to this contract, burned to reclaim NEST,
 *      then converted into brVeNEST, and finally notified to the external bribe contract.
 * @param pool_ The address of the pool for which the reward is being distributed.
 * @param tokenId_ The ID of the veNEST NFT to be burned to reclaim NEST.
 *
 * Emits a {NotifyRewardVeNESTInVeNest} event.
 * Reverts if the function is disabled, the pool is invalid, or the NFT is not eligible to be burned.
 */
function notifyRewardVeNESTInVeNest(address pool_, uint256 tokenId_) external;
```

#### Description
This function allows a user to:
1. Transfer a veNEST NFT to the router contract.
2. Burn the veNEST NFT to reclaim the underlying NEST.
3. Convert reclaimed NEST into `brVeNEST`.
4. Notify the external bribe contract for the specified pool about the rewards.

#### Requirements
- **Function Must Be Enabled:** Admin must ensure the function is enabled via `setupFuncEnable`.
- **veNEST Transfer Approval:** Caller must approve the router contract to transfer the specified veNEST NFT.
- **Valid Pool:** The specified `pool_` must map to a valid external bribe contract via the `voter` contract.
- **Burnable NFT:** The veNEST NFT must not be expired or restricted
#### Parameters
- `pool_`: Address of the pool for which the rewards are distributed.
- `tokenId_`: ID of the veNEST NFT to be burned.

#### Example Workflow
1. **Approve veNEST NFT Transfer:**
   ```solidity
   votingEscrow.approve(customBribeRewardRouter, tokenId);
   ```
2. **Call Function:**
   ```solidity
   customBribeRewardRouter.notifyRewardVeNESTInVeNest(poolAddress, tokenId);
   ```
3. **Result:**
   - veNEST NFT is transferred to the router.
   - The NFT is burned to reclaim NEST.
   - NEST is converted into `brVeNEST`.
   - The external bribe contract is notified about the new rewards.

