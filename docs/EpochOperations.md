# Nest Protocol — Epoch Operations

**Old Description:** https://github.com/FenixProtocol/fenix-core/blob/main/docs/admin/launch_and_support_protocol_work.md

## Contents
- [Timeline Groups (UTC)](#timeline-groups-utc)
- [Timeline](#timeline)
  - [1. During the epoch](#1-during-the-epoch-internal-bribes-accounting)
  - [2. Before epoch end – last hour](#2-before-epoch-end--last-hour-strategies-mvenfts-voting)
  - [3. Epoch transition (flip)](#3-epoch-transition-flip)
  - [4. First hour after epoch transition](#4-first-hour-after-epoch-transition-dettach-lock-windowstrategy-delay--strategy-claims-recover-options-venft-handling-and-compounding)
  - [5. Strategy reset votes](#5-reset-strategy-votes)
---

## Timeline Groups (UTC)
- **During the epoch** → fee-to-internal-bribe posting.  
- **Before epoch end — last hour** → strategy voting (managed veNFTs only).  
- **Epoch transition** → distribute emissions to *all* gauges (flip). Includes **Hyper EVM** batching rules.  
- **First hour or dettach strategy block duration after epoch transition** → strategy maintenance: harvest, manual convert to **NEST**, `compound`, then vote cleanup.  

#### Mermaid timeline
```mermaid
timeline
    title Nest Epoch Operations (UTC)
    Monday–Wednesday : During epoch — post LP fees to internal bribes (`Voter.distributeFees`) as needed
    Wednesday 23:00–23:59 : Strategies vote (managed veNFT only) to lock final allocations
    Thursday 00:00:01 : Flip epoch & distribute emissions (`Voter.distribute*`) — batch on Hyper EVM
    Thursday 00:00–01:00 : Strategy claim → convert to NEST → `compound()` (credit lockers)
    After 00:01 : `Voter.reset(managedTokenId)` (clean UI/UX), optional `poke`
```


## Timeline

### 1. During the epoch (Internal bribes accounting)

Ensure **LP swap fees** are credited into **internal bribes** so they are accounted for the **current epoch** and the UI/analytics reflect up‑to‑date rewards.

**Action — MUST be called (by anyone) before end of epoch, and periodically during the course of the epoch for every gauges**  
- Call on `Voter` contract:
  ```solidity
  // VoterUpgradeableV2
  function distributeFees(address[] calldata gauges) external
  ```
  - **What it does:** calls `IGauge(g).claimFees()` for each `g` and pushes collected **swap fees** into the **internal bribe** linked to that gauge.  
  - **Who can call:** **any user** (permissionless).  
  - **How often:** **any number of times per epoch**.  
  - **When:** recommended to call **as late as possible before epoch end** (to include the latest fees).  
  - **If not called in time:** the **unposted fees roll over** and will be included when `distributeFees(...)` is eventually called in a later epoch.

**Hyper EVM note**  
- Hyper EVM uses **small blocks with a strict block gas limit**. If you try to pass all gauges in a single `distributeFees(...)` call and the transaction exceeds the block gas/size limit:
  * the transaction will **revert as a whole**,
  * will need to **retry with smaller batches**, otherwise internal bribe accounting for this epoch will lag.
- Always use **batched chunks** of gauges to avoid tx size / block gas issues:
  * start with **10–30 gauges per transaction on Hyper EVM**,
  * monitor gas usage and shrink batch size if you see out-of-gas or block-limit reverts,
  * make sure that by the end of the epoch **all gauges have been covered at least once** by `distributeFees(...)`.
---

### 2. Before epoch end — last hour (strategies mVeNFTs voting)

**Window:** the final `distributionWindowDuration` (default **3600s**) before epoch end.  
During this window:

- **Regular veNFTs** are blocked from voting by the voter’s time-window checks.
- **Whitelisted managed veNFTs** (those controlled by Nest strategies) **are allowed** to vote and update their vote power distributions.

To ensure that a strategy’s **voting power is actually counted for the epoch**, its managed veNFT **must cast a vote** (or re-vote) for the target pools. If a strategy does not vote, its veNEST weight will not be reflected in gauge weights for that epoch, and it will not receive the intended share of emissions/bribes for those pools.
Each strategy therefore **can and should** vote at least once per epoch, and typically **in the last hour** to incorporate the most up-to-date bribe/fee information.

**Actions (per strategy, from an strategy authorized address)**
- Call on `CompoundVeNESTManagedNFTStrategyUpgradeable` contracts:  
  ```solidity
    /**
     * @notice Casts votes based on the strategy's parameters.
     * @param poolVote_ Array of pool addresses to vote for.
     * @param weights_ Array of weights corresponding to each pool address.
     */
    function vote(address[] calldata poolVote_, uint256[] calldata weights_) external onlyAuthorized {
        IVoter(voter).vote(managedTokenId, poolVote_, weights_);
    }
  ```
  Call on the strategy contract, not directly on the Voter.
---

### 3) Epoch transition (flip)

**When:** Immediately after the epoch boundary (e.g., **Thu 00:00:01 UTC** in typical ve(3,3) schedules).  

Flip epoch and distribute **emissions** to **all** gauges.

#### Primary path (if gas limits allow)
Call on `Voter` contract:
```solidity
    /**
     * @notice Distributes rewards to all pools managed by the contract.
     * @dev The Minter contract's update_period function is called before distributing rewards.
     */
    function distributeAll() external;
```
Use this if the number of pools is moderate and your chain’s block gas limit can fit a full pass over all gauges without reverting.
* **Who can call**: any user (permissionless).
* **How often**: one time after new time of epoch come.

#### Case: exceed block gas limit
```solidity
    /**
     * @notice Distributes rewards to a specified list of gauges.
     * @dev The Minter contract's update_period function is called before distributing rewards.
     * @param gauges_ An array of gauge addresses to distribute rewards to.
     */
    function distribute(address[] calldata gauges_) external;

     * @notice Distributes rewards to a specified range of pools.
     * @dev The Minter contract's update_period function is called before distributing rewards.
     * @param start_ The starting index of the pool array.
     * @param finish_ The ending index of the pool array.
     */
    function distribute(uint256 start_, uint256 finish_) external;
```

**Hyper EVM — batching rules**
- Hyper EVM has **small blocks**; large transactions can fail with *block gas limit* / *tx too large*.  
- Use **chunked** loops and tune `batchSize` by observation. Start with **25–50** gauges per tx; shrink on failures.  
- Ensure **full coverage** this epoch (no gauge left undistributed) — continue sending batches until all pools are processed.

---
### 4. First hour after epoch transition (dettach lock window/strategy delay) — strategy claims, recover options, veNFT handling, and compounding

Additional info and instructions: [Nest_Compound_Strategy.md](./integration/nest/Nest_Compound_Strategy.md)
After the epoch flips (first successful `Voter.distribute*`), **authorized operators** of every `CompoundVeNESTManagedNFTStrategyUpgradeable` must promptly:

- realize rewards,
- convert them to **NEST**, and
- call `compound()`

so value is actually credited to **lockers** (the managed veNFT).  
If this is skipped or delayed, users who detach after the strategy dettach lock windows open will **miss that epoch’s yield** in their veNEST balance.


#### What the strategy can do (quick map)

#### Claim bribes for the managed veNFT

```solidity
strategy.claimBribes(address[] bribes, address[][] tokens);
// → calls IVoter(voter).claimBribes(bribes, tokens, managedTokenId);
//   (claims per veNFT tokenId; the strategy owns this tokenId)
```

#### Claim + sweep (recover) ERC20 to an operator wallet (manual off‑chain convert)

```solidity
strategy.claimBribesWithERC20Recover(bribes, tokens, operator, tokensToRecover);
// Auth-gated via _checkBuybackSwapPermissions (admin or authorized)
// NOTE: erc20Recover blocks recovering NEST and any token whitelisted
//       in RouterV2PathProvider unless the manager enables
//       IGNORE_RESTRICTIONS_ON_RECOVER_TOKENS.
```

#### Claim + sweep ERC20 and veNFTs bribes (ERC721) to an operator wallet

```solidity
strategy.claimBribesWithTokensRecover(
  bribes,
  tokens,
  operator,
  tokensToRecover,
  veNftTokenIdsToRecover
);
// Auth-gated. veNFT recovery of VotingEscrow tokens is blocked unless
// manager enables IGNORE_RESTRICTIONS_ON_RECOVER_VE_NFT_TOKENS.
// The managedTokenId is NEVER recoverable (hard-blocked).
```

#### Compound NEST into the managed veNFT (credit lockers)

```solidity
strategy.compound();
// Uses strategy’s NEST balance for distribute compound rewards
```

#### If the strategy owns extra veNFTs (e.g., received as bribe or otherwise): merge them

```solidity
strategy.compoundVeNFTs(uint256[] tokenIds); // merge listed veNFTs into managedTokenId
strategy.compoundVeNFTsAll();                // merge all owned veNFTs except managedTokenId
// Requires the strategy to own these veNFTs; managedTokenId cannot be merged/recovered.
// Reverts with NotOtherVeNFTsAvailable / InvalidVeNFTTokenIds / ZeroCompoundVeNFTsReward on bad inputs.
```

---

#### First-hour flow (minimal, recommended)

For each strategy **right after flip**:

##### 1. Claim rewards & bribes

Either keep bribes on the strategy:

```solidity
strategy.claimBribes(bribes, tokens);
```

Or claim + sweep to operator (for manual conversion):

```solidity
strategy.claimBribesWithERC20Recover(bribes, tokens, operator, tokensToRecover);
```

> **Heads-up:** `erc20Recover` will revert for `NEST` and any token allowed by `RouterV2PathProvider` unless the manager enabled `IGNORE_RESTRICTIONS_ON_RECOVER_TOKENS`.

##### 2. Convert everything to NEST (off-chain)

The operator swaps claimed tokens to **NEST** and sends NEST back to the strategy.

##### 3. Compound into veNEST

```solidity
NEST.transfer(strategy, swappedBalance);
strategy.compound();
```

This locks NEST into `managedTokenId` and notifies the virtual rewarder so **lockers are credited**.

---

#### Handling bribes delivered as veNFTs (ERC721)

If a bribe/incentive arrives as a **veNFT**:

#### Keep & merge (on-strategy)

- Transfer the veNFT to the strategy (if not already owned) and call:

```solidity
strategy.compoundVeNFTs([tokenId]);
```

to merge it into the `managedTokenId`.

#### Sweep to operator (off-strategy)

- Use:

```solidity
strategy.claimBribesWithTokensRecover(..., veNftTokenIdsToRecover);
```

or:

```solidity
strategy.erc721Recover(votingEscrow, operator, tokenIds);
```

Requirements:

- The manager must enable `IGNORE_RESTRICTIONS_ON_RECOVER_VE_NFT_TOKENS`.
- The `managedTokenId` is **never** recoverable.

---

### 5. Reset strategy votes

After the epoch flips, **strategy votes do not disappear automatically** — the same weights continue into the new epoch until they are changed or reset.  
For clarity and correct UX, recommend **resetting votes for each managed strategy NFT**, after all compounding and reward processing is done.

After the epoch transition, clear votes to avoid showing stale weights for the current new epoch:
  ```solidity
  Voter.reset(managedTokenId);
  // Optionally, refresh the current allocation if needed:
  Voter.poke(managedTokenId);