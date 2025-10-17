# veNFT Strategy Withdrawal (Detachment) Lock Window

This document explains the **withdrawal/detachment lock window** for veNFT strategies, how it affects user flows, and how to **read** & **configure** the values on-chain.

---

## TL;DR

- After each **epoch start**, detaching a veNFT from a strategy can be **temporarily blocked**.
- The window length is the **effective lock duration**:
  - **Per-strategy override**: `detachmentLockDuration` (on the strategy). If non-zero, it wins.
  - Otherwise, **manager default**: `defaultDetachmentLockDuration()` (on the manager).
- Max allowed duration is **6 days** (enforced in both manager & strategy).
- One call tells you everything you need:
  ```solidity
  (bool locked, uint256 epochStart, uint256 lockEnd) = strategy.dettachLockWindowInfo();
  ```

---

## Reading the Lock State (Strategy)

### Recommended (single read)
```solidity
(bool locked, uint256 epochStart, uint256 lockEnd) = strategy.dettachLockWindowInfo();

if (locked) {
    // Detachment currently blocked; wait until lockEnd
} else {
    // Detachment allowed now
}
```

## Enforcement in the Strategy

The strategy blocks detachment during the active window:

```solidity
function onDettach(uint256 tokenId_, uint256 userBalance_) external ... returns (uint256) {
    (bool locked, , uint256 lockEnd) = dettachLockWindowInfo();
    if (locked) {
        revert DettachLockWindowActive(lockEnd); // unlockAt for UX
    }
    // withdraw + harvest logic...
}
```

**Error:** `DettachLockWindowActive(uint256 unlockAt)` is thrown if detachment is attempted while locked.

---

## Configuration

### Global baseline (Manager)
- **Read**:  
  `function defaultDetachmentLockDuration() external view returns (uint256)`
- **Set** (admins only):  
  `function setDefaultDetachmentLockDuration(uint256 newDuration_) external onlyRole(DEFAULT_ADMIN_ROLE)`
  - Caps at **6 days**; otherwise reverts with  
    `DetachmentLockDurationTooLong(value, max)`
- **Event**:  
  `event SetDefaultDetachmentLockDuration(uint256 previousDuration, uint256 newDuration)`

### Per-strategy override (Strategy)
- **Read** (public var / getter):  
  `function detachmentLockDuration() external view returns (uint256)`  
  (`0` ⇒ use manager default)
- **Set** (strategy `onlyAdmin`):  
  `function setDetachmentLockDuration(uint256 newDuration_) external onlyAdmin`
  - `0` ⇒ revert to manager default  
  - Caps at **6 days**; otherwise reverts with  
    `DetachmentLockDurationTooLong(value, max)`
- **Event**:  
  `event SetDetachmentLockDuration(uint256 previousDuration, uint256 newDuration)`

---

## Example Snippets

### UI countdown to unlock
```ts
const [locked, epochStart, lockEnd] = await strategy.dettachLockWindowInfo();
const now = Math.floor(Date.now() / 1000);
const secondsLeft = locked ? Math.max(0, lockEnd - now) : 0;
```

### Defensive detach (off-chain or other contracts)
```solidity
(bool locked,,) = strategy.dettachLockWindowInfo();
if (!locked) {
    // proceed with onDettach flow via the authorized path
}
```

---

## Edge Cases & Notes

- If **both** the strategy override **and** the manager default are `0`, the lock window is **disabled**.
- The **6-day cap** is enforced in both manager and strategy to keep policy consistent.

---

## Quick Reference

- **Manager default getter**: `defaultDetachmentLockDuration()`
- **Manager default setter**: `setDefaultDetachmentLockDuration(uint256)`
- **Strategy override getter**: `detachmentLockDuration()`
- **Strategy override setter**: `setDetachmentLockDuration(uint256)`
- **Status helper**: `dettachLockWindowInfo() → (locked, epochStart, lockEnd)`
- **Detachment guard**: `onDettach(...)` → reverts with `DettachLockWindowActive(unlockAt)` when locked
- **Max**: 6 days (manager `_MAX_DETACHMENT_LOCK_DURATION`, strategy `STRATEGY_MAX_DETACH_LOCK_DURATION`)
