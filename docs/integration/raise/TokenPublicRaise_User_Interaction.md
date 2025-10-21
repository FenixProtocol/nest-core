
# TokenPublicRaise – User Interaction Guide

This document explains how **users** and **front‑end integrators** interact with the fixed‑rate public raise based on the final implementation of `TokenPublicRaiseUpgradeable` and `ITokenPublicRaise`.

> TL;DR: Send native currency (e.g., ETH, HYPE) to the contract **during the active window**. The contract accounts your purchased tokens at a fixed rate and caps deposits by **per‑user** and **global** limits.

---

## 1) Glossary & Core Concepts

- **Fixed rate (`tokenPricePerOneNative`)**: Number of sale tokens allocated **per 1e18 native units**.  
  Example: if `1 ETH` buys `1,000` tokens (18 decimals), set `tokenPricePerOneNative = 1000e18`.

- **Active window**: Inclusive range `[startTimestamp, endTimestamp]` within which deposits are accepted.  
  - `isRaiseActive()` returns `true` iff `block.timestamp >= startTimestamp` **and** `<= endTimestamp`.

- **Caps**:
  - **Per‑user** cap: `maxDepositAmount` – total a single user can deposit.
  - **Global** cap: `totalDepositCap` – total accepted across all users.
  - Actual accepted amount in a deposit is `min(perUserRemaining, globalRemaining)`.

- **Minimum deposit rule**: `minDepositAmount` is **enforced on the user’s cumulative deposit**:  
  - A deposit **reverts** if `acceptedIn + userDeposited < minDepositAmount`.  
  - Practically: your **first successful deposit** must bring your **cumulative** amount to at least `minDepositAmount`.  
  - After your cumulative deposit ≥ `minDepositAmount`, any further positive top‑up (subject to caps) is allowed.

- **Accounting only**: The contract **does not transfer** the sale token; it only **accounts** purchased amounts (`userTokensAllocated`) for later distribution by airdrops/other contracts/processes.

---

## 2) User Journey

### Step A — Check if the raise is active
- Call `isRaiseActive()` → `true/false`.
- You can also retrieve the window using `getInfo(address(0))` → see `start`/`end` timestamps.

### Step B — Check how much you can still deposit
- Call `maxDeposit(user)` → returns the **maximum additional** native amount you can still deposit **right now** (already capped by *both* per‑user and global remaining).
- If your current cumulative deposit `< minDepositAmount`, you **must** deposit at least `minDepositAmount - userDeposited` to pass the minimum rule.

### Step C — Estimate purchased tokens
- Formula:  
  `tokensOut = amountIn * tokenPricePerOneNative / 1e18`  
- Example: `amountIn = 2 ETH`, `tokenPricePerOneNative = 10.5e18` → `tokensOut = 21.0e18` (21 tokens with 18 decimals).

### Step D — Deposit
- Use `deposit()` with `msg.value`, **or** send native currency directly (fallback `receive()`), while active.  
- The contract **caps** your input to `min(perUserRemaining, globalRemaining)`. If the cap is 0 → reverts.

### Step E — Verify your balances
- `userDeposited(user)` — total native deposited.
- `userTokensAllocated(user)` — total accounted purchased tokens.
- `getInfo(user)` — compact snapshot (see below).

> **After the raise ends:** users **cannot** deposit; only the owner can **withdraw** native funds to the `treasury` via `withdrawToTreasury()`.

---

## 3) Important View Methods

### `getInfo(user)`
Returns (in order):
```
active, start, end, min, max, globalCap, price, totalIn, userIn, userOut, userMaxDeposit
```
- `active` — `bool`, current `isRaiseActive()` result.
- `start`, `end` — raise window.
- `min`, `max` — min deposit (cumulative rule) and per‑user cap.
- `globalCap` — global cap; `totalIn` — total deposited across all users.
- `price` — tokens per 1e18 native.
- `userIn` — this user’s cumulative native deposit.
- `userOut` — accounted purchased tokens for this user.
- `userMaxDeposit` — maximum additional amount the user can still deposit **right now**.

### `maxDeposit(user)`
- Returns `min(globalRemaining, perUserRemaining)` **if active**, else `0`.

### `isRaiseActive()`
- `true` when `now` is between `start` and `end` (inclusive).

---

## 4) Reverts & Troubleshooting

- `RaiseNotActive()` — deposit attempted outside the active window.
- `DepositCapReached()` — global cap is already reached.
- `DepositAboveMax()` — you reached the per‑user cap; no more room.
- `DepositBelowMin()` — your cumulative after this deposit would still be `< minDepositAmount`. Increase `msg.value` to at least `limit - userDeposited`.
- `AmountZero()` — zero amounts are not allowed (e.g., trying to deposit 0 or tokensOut would compute to 0).
- `RaiseNotEnded()` — owner tried to withdraw before `endTimestamp`.
- `NativeTransferFailed()` — low‑level transfer to `treasury` failed.

> **Tip for UIs**: show a “suggested minimum top‑up” for users below `minDepositAmount`:  
> `requiredTopUp = minDepositAmount - userDeposited` (clamped to `maxDeposit(user)`).

---

## 5) Event Consumption

### `Deposited(user, amountIn, tokensOut)`
- Emitted for each accepted deposit (including fallback `receive()` path).  
  Use to index user activity / analytics dashboards.

### `TreasuryWithdrawn(treasury, amount)`
- Emitted when the owner withdraws all native funds to the treasury after the raise ends.

Other admin events:
- `TreasuryUpdated(newTreasury)`  
- `DepositLimitsUpdated(min, max, totalDepositCap)`  
- `RaiseWindowUpdated(start, end)`  
- `ExchangeRateUpdated(tokenPricePerOneNative)`