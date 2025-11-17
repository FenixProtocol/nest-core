# MinterUpgradeable Emission Management

This guide explains how to bring a fresh `MinterUpgradeable` instance online and how to steer weekly emissions with the `adjustmentBps` hook.

## Initial Setup

1. **Deploy logic, proxy, and token** – Deploy `MinterUpgradeable` and its proxy, deploy Nest, Voter, and VotingEscrow contracts, and record their addresses.
2. **Initialize** – Call `MinterUpgradeable.initialize(voter, votingEscrow)` via the proxy. This links the minter to the gauge voter and VE contracts, pre-fills supply parameters (`weekly`, `decayRate`, `inflationRate`, etc.), and stores the Nest ERC20 that will be minted.
3. **Transfer token ownership** – Transfer ownership of the Nest token contract to the minter so it can execute `nest.mint(...)` during distribution.
4. **Optional reconfiguration** – Before emissions start you may call the owner-only setters (`setVoter`, `setVotingEscrow`, `setTeamRate`, `setDecayRate`, `setInflationRate`) if the defaults (5% team split, 1% decay, 1.5% inflation, 20M/week initial emission) need to change.
5. **Start emissions** – When the system is ready, the owner calls `start()`. This locks in the first active period at the current Thursday 00:00 UTC and schedules the inflation window (`inflationPeriodCount` weeks). After `start()` anyone can call `update_period()` once per epoch to trigger minting as soon as `block.timestamp` passes the next Thursday.
- **!!! IMPORTANT: If you want to start a full 0 epoch, `start()` must be called after Thursday 00:00:00 UTC**

### Operational Cycle

- **Epoch cadence** – Emissions are computed per week (`WEEK = 7 days`). `update_period()` will mint only once per epoch and queues the next run.
- **Team & gauges payout** – Every minted amount is split between the owner (up to `MAX_TEAM_RATE = 5%`) and the voter contract, which later pushes rewards to gauges. Ensure the owner wallet is prepared to receive the team share.
- **Start delay** – If `startEmissionDistributionTimestamp`the contract will wait until that timestamp before minting
- **Monitoring** – Use the `Mint` and `Emission` events to verify `weekly`, `teamRate`, and `epochEmissionAdjustmentBps` values.

## Using Adjustment BPS

`setEpochEmissionAdjustmentBps(int256 adjustmentBps)` lets the owner nudge the next epoch’s emission up or down without redeploying. The value is expressed in basis points relative to `weekly` (10,000 = 100%) and is bounded by `MAX_EMISSION_ADJUSTMENT = ±2,500` (±25%).

### Workflow

1. Call `setEpochEmissionAdjustmentBps(bps)` before the next `update_period()` execution.
2. Once `update_period()` runs, the contract computes `adjustedWeekly = weekly * (10,000 + bps) / 10,000`, applies the team split, and resets `epochEmissionAdjustmentBps` back to zero.
3. Repeat this process whenever a temporary increase or reduction is required. Because the value resets, you must reapply the adjustment for every epoch that needs steering.

### Examples

| Scenario                        | `bps`  | Result                                                                    |
|---------------------------------|--------|---------------------------------------------------------------------------|
| Scale emissions up by 10%       | `+1000`| `weekly` becomes `weekly * 1.10` for the next mint.                       |
| Emergency throttle by 15%       | `-1500`| Reduces the next epoch by 15% while keeping team and gauges ratios intact.|