# Telaga LP Rewards — Payout Contract

Reference payout implementation for selective reuse alongside the backend signing and frontend claim code.

Adds `AvrRewardPayout`, a non-upgradeable ERC20 payout contract. A backend signature authorizes the caller's cumulative amount; the contract subtracts previous claims and pays the difference, capped by remaining accounted funding. Weekly budgets are enforced in Blaze.

Anyone can call `fund`; direct token transfers do not increase accounted funding. The owner can immediately rotate the signer or set it to zero to disable claims. There is no withdrawal function. Deploy one payout per compatible, non-rebasing ERC20 token without an outgoing transfer tax. No hook, factory, voter or minter changes are required.

**Integration**

1. Include `src/AvrRewardPayout.sol`, `test/AvrRewardPayout.t.sol`, the EIP-712 fixture/generator and the pinned dependency closure. Retain Solidity 0.8.26 and the payout build settings; adapt dependency paths to the destination layout.
2. Deploy with the reward token, owner and signer. Approve and call `fund(amount)`; register the resulting payout identity in Blaze. Deployment uses the developers' tooling; this package has no deployment script.
3. Use domain `GaugeRewarder`, version `1`, bound to the deployment chain/address, and `Claim(address user,uint256 totalAmount,uint256 deadline)`. The frontend calls `claim(totalAmount, deadline, signature)` with the supplied ABI.

**Validation:** 32 contract tests passed, covering funding, signatures, cumulative claims and failure paths. Run this standalone module from the repository root with Foundry and Solidity 0.8.26 available locally:

```sh
cd reference/telaga-lp-rewards
FOUNDRY_SOLC=/absolute/path/to/solc-0.8.26 forge test --match-contract AvrRewardPayoutTest -vv
```

The module builds offline with FFI disabled, Cancun, optimizer 200 runs and no bytecode metadata hash. Only the transitive Solidity dependency sources needed by this module are vendored; see `dependencies/DEPENDENCIES.json` for pinned versions and licences. The fixture generator uses Python 3 and Foundry `cast` offline.
