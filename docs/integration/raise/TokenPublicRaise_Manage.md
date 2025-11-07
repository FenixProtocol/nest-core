
# TokenPublicRaise – Admin Management Guide

This guide explains how **owners/administrators** operate and maintain the fixed‑rate public raise contract (`TokenPublicRaiseUpgradeable`) that implements `ITokenPublicRaise`.
---

## 1) Roles & Access Control

- **Owner (admin)** — single privileged role provided by `Ownable2StepUpgradeable`.  
  - Can call: `initialize` (once), `setTreasury`, `setDepositLimits`, `setRaiseWindow`, `withdrawToTreasury`, ownership transfer (`transferOwnership` / `acceptOwnership`).
- **Users** — can only deposit during the **active window** `[startTimestamp, endTimestamp]` and query views.

> Two‑step ownership handover prevents mistakes:  
> 1) `transferOwnership(newOwner)` — propose.  
> 2) `acceptOwnership()` — new owner accepts.

---

## 2) Deployment Topology (Recommended)

- Pattern: **TransparentUpgradeableProxy** + **ProxyAdmin** (OpenZeppelin).  
- Steps:
  1. **Deploy implementation** `TokenPublicRaiseUpgradeable` (constructor disables initializers).
  2. **Deploy proxy** pointing at the implementation.
  3. **Initialize** the proxy exactly once via `initialize(...)`.
---

## 3) Initialization Checklist

Call `initialize(start, end, min, max, cap, price, treasury)` **once** on the proxy.

- `start` / `end`: inclusive timestamps for the **active window**. Must satisfy `end > start`.  
- `min` (`minDepositAmount`): **cumulative minimum** per user. A user’s **first successful** deposit must bring their total to at least this value.  
- `max` (`maxDepositAmount`): per‑user cap (total across all deposits).  
- `cap` (`totalDepositCap`): global cap across all users.  
- `price` (`tokenPricePerOneNative`): tokens per **1e18** native units (e.g., per 1 ETH).  
- `treasury`: destination for post‑raise withdrawal (non‑zero address).

Emitted events on success:
- `TreasuryUpdated(treasury)`  
- `DepositLimitsUpdated(min, max, cap)`  
- `RaiseWindowUpdated(start, end)`  
- `ExchangeRateUpdated(price)`
---

## 4 Adjusting Parameters Safely
- **Treasury**: `setTreasury(newTreasury)` — updates destination address for withdrawal.
- **Deposit limits**: `setDepositLimits(min, max, cap)` — updates min/per‑user/global caps.
  - Allowed to **reduce** values; the contract tolerates values below current totals:
    - If `max` < `userDeposited[user]`, that user simply cannot deposit further (remaining becomes 0).
    - If `cap` < `totalDeposited`, global remaining becomes 0 and **new deposits are blocked**.
  - **Recommendation**: avoid surprising users; communicate changes in advance.
- **Raise window**: `setRaiseWindow(start, end)` — can move the schedule.
  - Use with care; ensure the new `end > start`.  
  - Extending the end can allow more deposits; shrinking can cut off the window.

All setters emit respective events for observability.

---

## 5) Post‑Raise Actions, Withdraw Native Funds to Treasury
- Allowed **only after** `block.timestamp > endTimestamp`.
- Call `withdrawToTreasury()` (owner‑only).  
  - Transfers the **entire** native balance of the contract to `treasury`.
  - Emits `TreasuryWithdrawn(treasury, amount)`.
  - Reverts with `RaiseNotEnded` if called before end, or `NativeTransferFailed` on low‑level transfer failure.
---

## 6) Exchange Rate (Price) Management

**Method:** `setTokenPricePerOneNative(uint256 price)` (owner‑only)

- **Definition:** `price` is the number of sale tokens received **per 1e18 native units**.  
  Example: if 1 ETH should buy 1,000 tokens (18 decimals), set `price = 1000e18`.

- **Emits:** `ExchangeRateUpdated(price)`  
- **Reverts:** `AmountZero` if `price == 0`.

**Effects & Guarantees**
- The **new price applies only to future deposits**. Previously accounted allocations (`userTokensAllocated`) **are not retroactively changed**.
- `tokensOut` is computed as `amount * price / 1e18` and must be **non‑zero**; extremely small amounts or prices can cause `AmountZero` to revert on deposit.
- Changing price **does not** affect caps or totals other than how many tokens are accounted per unit of native going forward.
- Front‑ends should read `getInfo(user).price` to display the current price to users.

**Operational Guidance**
- Prefer fixing price before opening the window. If mid‑raise changes are necessary (e.g., peg shift), **announce publicly** to avoid user confusion.
- Consider grace periods or pausing UI deposits during the update, then resume once the new price is indexed by front‑ends.

---

## 7) Upgrade & Ownership Management

- **Ownership transfer** (two‑step):
  1) `transferOwnership(newOwner)`
  2) `acceptOwnership()` (called by `newOwner`)

- **Upgrade** (with OZ upgrades plugin):
  - Deploy new implementation.
  - Use `ProxyAdmin.upgrade(proxy, newImplementation)`.
  - No storage layout changes to existing variables unless audited and migration‑safe.

> Always test upgrades on a staging/testnet with realistic state snapshots before mainnet execution.