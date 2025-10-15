# VolatileDynamicFeeOnePool_Integration.md

## 1) Read the effective fee **via PairFactory** (recommended)

Always resolve the fee through the factory so app matches protocol behavior.

- `getFee(address pair_, bool stable_) -> uint256 feeBps`  
  Returns the fee used by the protocol for `pair_`.
- `getCustomVolatileDynamicFeeModule(address pair_) -> address module`  
  Returns the volatile dynamic-fee module address for `pair_` (or `address(0)` if none).

**Factory resolution order (pseudologic):**
1) If a per-pair override `_customFee[pair_] != 0` → **use it**.  
2) If `stable_ == true` → **use** the factory’s `stableFee`.  
3) Otherwise (volatile):
   - If `module == address(0)` → **use** the factory’s `volatileFee`.
   - Else, if `module.isEnable()` and `module.getFee(pair_)` returns `success == true` → **use `dynamicFee`**.
   - Else → **use** the factory’s `volatileFee`.

> Note: In the provided module, `isEnable()` always returns `true`, and `getFee` returns `(true, feeBps)`; thus, once a module is set for a pair, the factory will typically take the module value unless an override exists.

---

## 2) VolatileDynamicFeeOnePool: fields & methods

**State (public):**
- `pair: address` — the exact pair this module is attached to.  
- `decreaseInterval: uint256` — seconds per step.  
- `decreaseStepBps: uint256` — BPS decrease per step (e.g., `100` = `1%`).  
- `startFeePercentage: uint256` — initial fee (BPS).  
- `finalFeePercentage: uint256` — lower bound (BPS).  
- `startTimestamp: uint256` — schedule start timestamp (if `0`, the pure helper treats schedule as “not started”).

**Events:**
- `SetStartTimestamp(uint256 startTimestamp)` — emitted on `startTimestamp` update.

**Errors (subset):**
- `AddressZero()` — zero address not allowed.  
- `InvalidCaller()` — caller not authorized.  
- `InvalidExpectPair()` — wrong `pair_` passed.  
- `InvalidConfiguration()` — bad parameters (e.g., fees out of range, zero interval/step).

**External/Public functions:**
- `initialize(...)` — sets up the module for one pair; validates parameters.  
- `setStartTimestamp(uint256 startTimestamp_)` — owner-only setter.  
- `isEnable() -> bool` — returns `true` (current implementation).  
- `getFee(address pair_) -> (bool success, uint256 feeBps)` — returns the module’s current fee for `pair_` (reverts with `InvalidExpectPair` if `pair_` mismatches).  
- `calculate(uint256 currentTimestamp_, uint256 startTimestamp_, uint256 startFeePercentage_, uint256 finalFeePercentage_, uint256 decreaseInterval_, uint256 decreaseStepBps_) -> uint256 feeBps` — pure helper for schedule math.

---

## 3) Calculation quick reference

Let:
- `S = startTimestamp`  
- `t = currentTimestamp`  
- `start = startFeePercentage (bps)`  
- `final = finalFeePercentage (bps)`  
- `step = decreaseStepBps (bps)`  
- `interval = decreaseInterval (sec)`

**Rules:**
- If `S == 0` or `t <= S` → fee = `start`.
- Else, `elapsed = t - S`, `steps = floor(elapsed / interval)`.
- Compute the step when the minimum is reached:
  - `delta = start - final`
  - `stepsToMin = ceil(delta / step) = (delta + step - 1) / step`
- If `steps >= stepsToMin` → fee = `final` (clamped).  
  Else → fee = `start - steps * step`.

**Units:** BPS for fees; seconds for time. `_PRECISION = 10_000` (100%).

---

## 4) Worked examples (BPS)

### A) Multiple-of-step minimum (clamp at step 49)
- `start = 5_000`, `final = 100`, `step = 100`, `interval = 60s`  
- `delta = 4_900` → `stepsToMin = ceil(4900/100) = 49`  
- Timeline (let `S` be the start):
  - `t = S` → `5_000`  
  - `t = S + 1*60` → `4_900`  
  - `...`  
  - `t = S + 48*60` → `200`  
  - `t = S + 49*60` and later → **clamped to `100`**

### B) Non-multiple minimum (clamp at step 51)
- `start = 5_100`, `final = 50`, `step = 100`, `interval = 60s`  
- `delta = 5_050` → `stepsToMin = ceil(5050/100) = 51`  
- Timeline:
  - `t = S + 50*60` → `5_100 - 50*100 = 100` (not yet final)  
  - `t = S + 51*60` and later → **clamped to `50`**
