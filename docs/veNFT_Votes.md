# veNFT_Votes.md

## veNFT Voting via Voter Contract (VoterUpgradeableV2)

This document explains how to use a **simple NEST veNFT** to vote via the **Voter** contract on HyperEVM.

- **Contract (proxy):** `0x566bdc5444fd5fe5d93ec379Bd66eC861ddbA901`
- **Explorer link (Write as Proxy):**  
  https://hyperevmscan.io/address/0x566bdc5444fd5fe5d93ec379Bd66eC861ddbA901#writeProxyContract

---

## 1. Prerequisites

### 1.1 HyperEVM network in your wallet
Your wallet (e.g., MetaMask) must be connected to the **HyperEVM mainnet**.

### 1.2 A simple veNFT (veNEST)
- You have locked NEST in the **VotingEscrow** contract and received a veNFT.
- You know your veNFT `tokenId` (from UI or wallet NFT list).

### 1.3 Pool addresses you want to vote for
- `vote()` expects **pool addresses, not gauge addresses**.
- Each pool must have a gauge registered in `poolToGauge`, otherwise the transaction reverts with `GaugeAlreadyKilled`.

### 1.4 Sufficient veNFT voting power
- Voting power = `balanceOfNFT(tokenId)` from the VotingEscrow contract.
- If too small, expired, or attached to mVeNFT may revert tx.

---

## 2. Time Rules (Important)

### 2.1 Voting window (weekly epoch)
Voting is allowed only during a safe middle window of each week.

Blocked periods:
- the first `distributionWindowDuration` seconds of the week, default is 3600 seconds. 
- the last `distributionWindowDuration` seconds of the week, default is 3600 seconds. 

If you see `DistributionWindow` error in tx, you are too early or too late in the epoch.

### 2.3 Voting paused
If `votingPaused == true`, operations are blocked:
- `vote`
- `reset`
- `poke`

Reverts with `DisableDuringVotingPaused`.

### 2.4 Ownership / approval
You must be **owner or approved** for the target veNFT token.

Otherwise calls revert with `AccessDenied`.

---

## 3. Interacting via HyperEVMScan (“Write as Proxy”)

Because this is a **proxy contract**, you must use **Write as Proxy**.

Steps:
1. Visit  
   https://hyperevmscan.io/address/0x566bdc5444fd5fe5d93ec379Bd66eC861ddbA901#writeProxyContract
2. Click **Write as Proxy**.
3. Click **Connect to Web3**.
4. Use functions:
   - `vote(uint256 tokenId_, address[] poolsVotes_, uint256[] weights_)`
   - `reset(uint256 tokenId_)`
   - `poke(uint256 tokenId_)`

---

## 4. Voting with a Simple veNFT (`vote`)

### 4.1 Concept
`vote(tokenId, pools[], weights[])`:

- Takes total veNFT power.
- Splits across pools based on **relative weights**.

### 4.2 Choosing weights
Examples:
- `[1,1]` → 50/50
- `[1,2]` → 33/67
- `[10,5,5]` → 50/25/25
- `[1e18, 1e18]` -> 50/50

Requirements:
- lengths of `pools` and `weights` must match (`ArrayLengthMismatch`)
- each computed vote power > 0 (`ZeroPowerForPool`)
- every pool must have a valid gauge (`GaugeAlreadyKilled`)


#### 4.2.1 Concrete numeric example (tokenId = 2, 4 pools)

Assume:

- `tokenId_ = 2`
- `nftVotePower = balanceOfNFT(2) = 100e18`
- You want to distribute voting power across **4 pools** with weights:
  - 50, 30, 10, 10 (i.e. 50%, 30%, 10%, 10%)

Let the four pool addresses be:

- `pool0 = 0x1111111111111111111111111111111111111111`
- `pool1 = 0x2222222222222222222222222222222222222222`
- `pool2 = 0x3333333333333333333333333333333333333333`
- `pool3 = 0x4444444444444444444444444444444444444444`

Weights array:

```
weights = [50, 30, 10, 10]
```

So:

- `pool0`: `50 * 100e18 / 100 = 50e18`
- `pool1`: `30 * 100e18 / 100 = 30e18`
- `pool2`: `10 * 100e18 / 100 = 10e18`
- `pool3`: `10 * 100e18 / 100 = 10e18`

All four `votePowerForPool` are > 0, so there is no `ZeroPowerForPool` and the vote is valid.

How this looks in the `vote` parameters:

- `tokenId_ = 2`
- `poolsVotes_ = [pool0, pool1, pool2, pool3]`

```
[
  0x1111111111111111111111111111111111111111,
  0x2222222222222222222222222222222222222222,
  0x3333333333333333333333333333333333333333,
  0x4444444444444444444444444444444444444444
]
```

- `weights_ = [50, 30, 10, 10]`

On HyperEVMScan UI:

- `tokenId_`: `2`
- `poolsVotes_`: add 4 entries with the pool addresses above.
- `weights_`: `[50, 30, 10, 10]`.

The contract will internally compute:

- 50e18 votes power to `pool0`
- 30e18 votes power to `pool1`
- 10e18 votes power to `pool2`
- 10e18 votes power to `pool3`

based on your 100e18 veNFT power.

---
## 5. Clearing Votes (`reset`)

### 5.1 Concept
`reset(tokenId_)`:

- Removes **all** votes for the current epoch.

You do **not** need to call this before `vote()`, because `vote()` always clears votes itself.

### 5.2 Step-by-step
1. Open **Write as Proxy**.
2. Go to `reset`.
3. Enter `tokenId_`.
4. Submit transaction.

After success:
- all votes removed

---

## 6. Refresh Votes with Updated Power (`poke`)

### 6.1 Concept
`poke(tokenId_)`:

- Keeps the **same pool distribution**,
- Recomputes vote power using **current** veNFT balance.

Internally:
1. Reads current pools and stored weights.
2. Calls `_vote()` again (which resets & reassigns votes).

Use when:
- your veNFT balance changed,
- you want the same distribution refreshed.

### 6.2 Step-by-step
1. Open **Write as Proxy**.
2. Go to `poke`.
3. Enter `tokenId_`.
4. Submit.

After success:
- same pools,
- new vote power,
---