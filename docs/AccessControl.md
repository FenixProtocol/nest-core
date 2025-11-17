# Nest Core Access Control Overview

## Overview
Nest Core's access model combines upgradeable proxies, role-based contracts, ownership based contracts This document aggregates every privileged surface.

## Table of Contents
- [Operational Recovery Guidelines](#operational-recovery-guidelines)
- **Core**
  - [ProxyAdmin](#proxyadmin)
  - [VoterUpgradeableV2](#voterupgradeablev2)
  - [VotingEscrowUpgradeableV2](#votingescrowupgradeablev2)
  - [VeNestSplitMerklAidropUpgradeable](#venestsplitmerklaidropupgradeable)
  - [Blaze GaugeRewarder](#blaze-gaugerewarder)
  - [MinterUpgradeable](#minterupgradeable)
  - [BribeFactoryUpgradeable](#bribefactoryupgradeable)
  - [BribeUpgradeable](#bribeupgradeable)
  - [TokenPublicRaiseUpgradeable](#tokenpublicraiseupgradeable)
  - [GaugeUpgradeable](#gaugeupgradeable)
  - [GaugeFactoryUpgradeable](#gaugefactoryupgradeable)
  - [FeesVaultFactoryUpgradeable](#feesvaultfactoryupgradeable)
  - [FeesVaultUpgradeable](#feesvaultupgradeable)
  - [CompoundEmissionExtensionUpgradeable](#compoundemissionextensionupgradeable)
  - [BribeVeNESTRewardToken](#bribevenestrewardtoken)
  - [CustomBribeRewardRouter](#custombriberewardrouter)

- **Dex V2**
  - [Pair](#pair)
  - [PairFactoryUpgradeable](#pairfactoryupgradeable)
  - [VolatileDynamicFeeOnePool](#volatiledynamicfeeonepool)

- **Dex V3**
  - [AlgebraFactoryUpgradeable](#algebrafactoryupgradeable)
  - [AlgebraPool](#algebrapool)
  - [AlgebraBasePluginV1](#algebrabasepluginv1)

- **Nest Strategies**
  - [BaseManagedNFTStrategyUpgradeable (abstract)](#basemanagednftstrategyupgradeable-abstract)
  - [ManagedNFTManagerUpgradeable](#managednftmanagerupgradeable)
  - [CompoundVeNESTManagedNFTStrategyFactoryUpgradeable](#compoundvenestmanagednftstrategyfactoryupgradeable)
  - [CompoundVeNESTManagedNFTStrategyUpgradeable](#compoundvenestmanagednftstrategyupgradeable)
  - [RouterV2PathProviderUpgradeable](#routerv2pathproviderupgradeable)

- **Utils**
  - [VeNFTAPIUpgradeable](#venftapiupgradeable)
  - [GetInformationAggregatorUpgradeable](#getinformationaggregatorupgradeable)
  - [PairAPIUpgradeable](#pairapiupgradeable)
  - [RewardAPIUpgradeable](#rewardapiupgradeable)

- **Other**
  - [NestRaiseUpgradeable](#nestraiseupgradeable)
  - [RNest](#rnest)
  - [VeBoostUpgradeable](#veboostupgradeable)
  - [VeNestDistributorUpgradeable](#venestdistributorupgradeable)
  - [PerpetualsGaugeUpgradeable](#perpetualsgaugeupgradeable)
  - [PerpetualsTradersRewarderUpgradeable](#perpetualstradersrewarderupgradeable)
  - [ManualNESTPriceProvider](#manualnestpriceprovider)
  - [MerklGaugeMiddleman](#merklgaugemiddleman)
  - [OpenOceanVeNftDirectBuyer](#openoceanvenftdirectbuyer)
  - [MinimalLinearVestingUpgradeable](#minimallinearvestingupgradeable)

## Operational Recovery Guidelines

This section provides high-level recommended actions for incident recovery depending on the severity of compromise and the upgradeability of the affected contract. It applies to all privileged roles and key-controlled components of the protocol.

### 1. Key Compromised but Access Still Available
If a privileged wallet is suspected to be compromised **but you still control it**:

**Recommended actions**
- Immediately transfer the role/ownership to a new secure multisig or governance wallet.
- Rotate all related operational keys (signers, keepers, relayers, distributors).
- Inspect configuration modified by the compromised key:
  - Validate integrations, fee settings, distribution flows, and addresses.
  - Restore correct configuration where needed.
- Review on-chain actions executed by the compromised key and assess impact.

---

### 2. Key Compromised AND Malicious User Has Already Transfer Control
If  privileged key was compromised **and the malicious user has already transferred roles/ownership** to themselves:

**Recommended actions**
- Use a **higher-privilege authority** to override the attacker:
  - For role-based systems: use a parent role (e.g., `DEFAULT_ADMIN_ROLE`, governance) to revoke attacker’s access.
  - For Ownable proxies: use `ProxyAdmin` or governance-controlled admin to force-transfer ownership.
- Reassign the correct roles/ownership to a secured multisig.
- Revert or fix any malicious configuration:
  - Suspicious new gauges, bribes, fee modules, plugin addresses, vaults or reward routes.
  - Changed treasury or distribution addresses.
- For contracts with emergency modes, consider enabling them temporarily until full restoration is complete.

---

### 3. Full Loss of Access but Contract Is Upgradeable
If all privileged keys for a contract are lost **but the contract is upgradeable**:

**Recommended actions**
- Use `ProxyAdmin` (or equivalent upgrade owner) to:
  - Deploy a new implementation that restores governance control.
  - Strip or reset broken/incorrect admin/role references inside the contract.
- After regaining control:
  - Reassign correct roles and ownership.
  - Validate all integrations and restore safe parameters.
  - Optionally migrate to a new contract if the upgrade path is unreliable.

---

### 4. Full Loss of Access AND Contract Is Not Upgradeable
If a non-upgradeable contract has lost all admin keys:

**Recommended actions**
- If the contract exposes any **emergency shut-off functions**, activate them to mitigate further damage.
- Immediately isolate the contract from the protocol:
  - Remove it from factories, registries, routing logic, or distribution flows.
  - Disable front-end interactions.
- Prepare a **migration plan**:
  - Deploy a replacement contract under secure governance.
  - Provide a migration path for users (withdraw, re-stake, migrate positions).
- For DEX pairs or gauges:
  - Encourage users to withdraw liquidity or claim rewards.
  - Front-end should treat the contract as deprecated.

This section can be reused for all roles and components described in the access-control overview.


## ProxyAdmin

Top-level owner of upgradeable proxies, able to change implementations and proxy admins for every protocol contract.

### Capabilities
- Upgrade proxy implementations for core contracts (e.g. `VoterUpgradeableV2`, `VotingEscrowUpgradeableV2`, `GaugeRewarder`, `MinterUpgradeable`, etc.).
- Transfer of the admin (owner) of each proxy.

### Assign To
- Very high-security governance or timelock contract.
- Long-lived EOAs are **strongly discouraged**.

### Emergency actions
- If the `ProxyAdmin` key is compromised, treat all upgradeable contracts as at risk.
- Immediately transfer ownership from `ProxyAdmin` to new wallet, migrate to a new governance-controlled `ProxyAdmin`

---

## VoterUpgradeableV2

Central coordination point for creating gauges, receiving user votes, and distributing emissions.


### DEFAULT_ADMIN_ROLE

Super-administrator with full control over access in the Voter.

**Capabilities**
- Grant and revoke any role, including `DEFAULT_ADMIN_ROLE`, `GOVERNANCE_ROLE`, and `VOTER_ADMIN_ROLE`.
- Pause or unpause the voting process globally.

**Assign To**
- Timelock / Governance module / Multisig.
- Direct assignment to EOAs is **not recommended**.

**Emergency actions**
- If this key is compromised:
  - Use governance / ProxyAdmin to upgrade `VoterUpgradeableV2` with a fresh admin.
  - If access remains to the admin wallet, remove the roles from it and transfer it to a new wallet (Review other roles holders, and revoke/grants actions are also needed).
    ```solidity
    // called by DEFAULT_ADMIN_ROLE on VoterUpgradeableV2
    grantRole(DEFAULT_ADMIN_ROLE, newAdmin);
    revokeRole(DEFAULT_ADMIN_ROLE, compromisedAdmin);
    ```

---

### GOVERNANCE_ROLE

Manages gauge lifecycle and safety.

**Capabilities**
- Create new gauges (V2/V3/custom).
- Kill gauges to stop emissions to malicious or misconfigured pools.
- Revive killed gauges once they are safe.

**Assign To**
- DAO / governance multisig or on-chain governance.
- EOA is acceptable for fast reaction / automation, but must be highly protected and rotated out quickly.

**Emergency actions**
- If this key is compromised:
  ```solidity
  // called by DEFAULT_ADMIN_ROLE on VoterUpgradeableV2
  revokeRole(GOVERNANCE_ROLE, compromisedGovernance);
  grantRole(GOVERNANCE_ROLE, newGovernance);
  ```
- Governance should also kill any suspicious gauges created or modified by the malicious user.

---

### VOTER_ADMIN_ROLE

Operational role that maintains external integrations and voting window configuration.

**Capabilities**
- Update addresses of minter, pool/gauge factories, rewarders, Merkl airdrop, managed-NFT manager, compounder, etc.
- Configure the voting window timing each epoch.

**Assign To**
- Operations / protocol engineering multisig.
- Protocol-owned automation contracts if needed.
- Direct EOAs wallet discouraged, except very short-lived at deployment, with subsequent transfer to multisign wallet.

**Emergency actions**
- If this key is compromised:
  ```solidity
  // called by DEFAULT_ADMIN_ROLE on VoterUpgradeableV2
  revokeRole(VOTER_ADMIN_ROLE, compromisedOps);
  grantRole(VOTER_ADMIN_ROLE, newOps);
  ```
- Review and restore params/integrations to right address if there were changes:
  ```solidity
  // called by VOTER_ADMIN_ROLE on VoterUpgradeableV2
  updateAddress("minter", safeMinter);
  updateAddress("gaugeRewarder", safeGaugeRewarder);
  updateAddress("compoundEmissionExtension", safeCompounder);
  updateAddress("managedNFTManager", safeManagedManager);
  ...
  ...
  ```

---

## VotingEscrowUpgradeableV2

Manages veNFT locks, boosts, permanent locks, managed-NFT attachments, and voting power accounting.

### Owner (Ownable2Step)

Primary administrator controlling external integrations used by the VotingEscrow.

**Capabilities**
- Set art proxy, boost contract, managed NFT manager, Voter, and custom bribe reward router.
- Redirect these integrations to new deployments.

**Assign To**
- Governance / timelock / multisig.
- EOAs only for bootstrap before transferring ownership to multisign/timelock/Governance.

**Emergency actions**
- If this key is compromised:
  - Use `ProxyAdmin` or higher-level governance to transfer or override ownership.
  - From the new owner review and restore integration modules address:
    ```solidity
    updateAddress("voter", safeVoter);
    updateAddress("managedNFTManager", safeManagedNFTManager);
    updateAddress("veBoost", safeVeBoost);
    updateAddress("artProxy", safeArtProxy);
    updateAddress("customBribeRewardRouter", address(0));
    ....
    ```

---

## VeNestSplitMerklAidropUpgradeable

Manages a Merkle-based airdrop that can pay users in pure tokens or veNFT locks.

### Owner (Ownable2Step)

Admin for airdrop configuration and pause control.

**Capabilities**
- Pause/unpause claims.
- Set Merkle root and pure token rate.
- Add/remove allowed claim operators.
- Recover remaining tokens when paused.

**Assign To**
- Governance / timelock / multisig.
- Direct assignment to EOAs is **not recommended**.

**Emergency actions**
- If this key is compromised:
  ```solidity
  // first, freeze operations
  VeNestSplitMerklAidropUpgradeable.pause();
  // then, from new secure owner after ownership change:
  VeNestSplitMerklAidropUpgradeable.setIsAllowedClaimOperator(compromisedOperator, false);
  VeNestSplitMerklAidropUpgradeable.setMerklRoot(bytes32(0));
  VeNestSplitMerklAidropUpgradeable.setPureTokensRate(0);
  ```
- Ownership itself should be moved to a new multisig via ProxyAdmin / governance.

---

## CompoundEmissionExtensionUpgradeable

Auxiliary module that compounds claimed emissions into veNFT locks and/or bribe pools.  
Controlled fully via roles defined in the `Voter` contract.


### COMPOUND_EMISSION_EXTENSION_ADMINISTRATOR_ROLE

Admin role for global default lock configuration.

**Capabilities**
- Set or update the default `CreateLockConfig` used when creating new locks via compounding.

**Assign To**
- Governance / timelock / multisig / EOAs.

**Emergency actions**
- If this key is compromised:
  ```solidity
  // called by DEFAULT_ADMIN_ROLE on VoterUpgradeableV2
  VoterUpgradeableV2.revokeRole(COMPOUND_EMISSION_EXTENSION_ADMINISTRATOR_ROLE, compromisedAdmin);
  VoterUpgradeableV2.grantRole(COMPOUND_EMISSION_EXTENSION_ADMINISTRATOR_ROLE, newAdmin);
  ```
- Then the new admin should reset a safe default config:
  ```solidity
  CompoundEmissionExtensionUpgradeable.setDefaultCreateLockConfig(safeConfig);
  ```

---

### COMPOUND_KEEPER_ROLE

Execution role for batch-compounding user emissions.

**Capabilities**
- Call `compoundEmissionClaimBatch` for multiple users.

**Assign To**
- Keeper / automation infrastructure under protocol control.
- EOAs acceptable if hardened and rotated quickly when needed.

**Emergency actions**
- If this key is compromised:
  ```solidity
  // called by DEFAULT_ADMIN_ROLE on VoterUpgradeableV2
  VoterUpgradeableV2.revokeRole(COMPOUND_KEEPER_ROLE, compromisedKeeper);
  VoterUpgradeableV2.grantRole(COMPOUND_KEEPER_ROLE, newKeeper);
  ```

---

## Blaze GaugeRewarder

Distributes a reward token across epochs and gauges and handles user claims via EIP-712 signatures.

### DEFAULT_ADMIN_ROLE

Top-level admin for GaugeRewarder roles and signer.

**Capabilities**
- Grant/revoke `REWARDER_ROLE` and `CLAMER_FOR_ROLE`.
- Set or clear the EIP-712 `signer` (control signatures for claimes emissions).

**Assign To**
- Governance / timelock / multisig.
- EOAs not recommended.

**Emergency actions**
- If this key is compromised:
  - Replace the admin via ProxyAdmin / governance (e.g. upgrade implementation).
  - Then, from the new admin:
    ```solidity
    // called by DEFAULT_ADMIN_ROLE on GaugeRewarder
    GaugeRewarder.setSigner(address(0)); // freeze all claims
    GaugeRewarder.revokeRole(REWARDER_ROLE, compromisedRewarder);
    GaugeRewarder.revokeRole(CLAMER_FOR_ROLE, compromisedClaimer);
    GaugeRewarder.grantRole(DEFAULT_ADMIN_ROLE, newAdmin);
    GaugeRewarder.revokeRole(DEFAULT_ADMIN_ROLE, compromisedAdmin);
    ```

---

### signer (authorized address)
Off-chain address that signs `EIP-712 Claim(...)` messages.

**Capabilities**
- Authorizes user reward claims; on-chain contract verifies recover(...) == signer.
- Set or clear the EIP-712 `signer` (control signatures for claimes emissions).

**Assign To**
- Backend / service key in HSM or hardware wallet.
- EOAs acceptable but must be tightly secured and rotated on suspicion.

**Emergency actions**
- If this key is compromised:
    ```solidity
      // called by DEFAULT_ADMIN_ROLE on GaugeRewarder
      GaugeRewarder.setSigner(address(0));    // immediately stop new claims
      GaugeRewarder.setSigner(newSigner);     // after secure key rotation
    ```
---
### REWARDER_ROLE

Reward distribution role.

**Capabilities**
- Notify rewards for gauges via:
  - `notifyReward`
  - `notifyRewardWithTransfer`

**Assign To**
- Protocol reward distribution multisig, infrastructure, EOAs wallet.

**Emergency actions**
- If this key is compromised:
  ```solidity
  // called by DEFAULT_ADMIN_ROLE on GaugeRewarder
  GaugeRewarder.revokeRole(REWARDER_ROLE, compromisedRewarder);
  GaugeRewarder.grantRole(REWARDER_ROLE, safeRewarder);
  ```

---

### CLAMER_FOR_ROLE

Relayer role for claiming on behalf of users.

**Capabilities**
- Call `claimFor(user, totalAmount, deadline, signature)`.

**Assign To**
- Relayer/Voter Contract or additional claim services.
- EOAs acceptable if monitored and rotated.

**Emergency actions**
- If this key is compromised:
  ```solidity
  // called by DEFAULT_ADMIN_ROLE on GaugeRewarder
  GaugeRewarder.revokeRole(CLAMER_FOR_ROLE, compromisedClaimer);
  ```

---

## MinterUpgradeable

Defines the weekly NEST emission schedule, inflation/decay parameters, and distribution between team and gauges.

---

### Owner (Ownable2Step)

Emission controller and integration manager.

**Capabilities**
- Start or stop emissions (indirectly by changing parameters).
- Adjust team rate, inflation rate, and decay rate.
- Emissions adjustment `-25%` to `25%`.
- Update `voter` and `votingEscrow` addresses used by the minter.

**Assign To**
- Governance / timelock / multisig (highly sensitive role).
- EOAs strongly discouraged in production.

**Emergency actions**
- If this key is compromised:
  - Use `ProxyAdmin` rights upgrade to new implementation, with reassign of owner.
  - Governance may also upgrade the minter implementation via `ProxyAdmin` to a safe version with no dangerous logic.

---
## BribeFactoryUpgradeable

Factory responsible for deploying bribe contracts and managing default reward-token configuration.

---

### Owner (OwnableUpgradeable)

Top-level administrator of the bribe factory.

**Capabilities**
- Set the `voter` address used to authorize factory-level operations.
- Set the `bribeImplementation` used for proxy-based bribe creation.
- Pause or unpause reward-claim functionality across all bribe contracts.
- Add or remove default reward tokens applied to new bribes.
- Inject additional reward tokens into existing bribes.

**Assign To**
- Governance / timelock / multisig.  
- Direct assignment to EOAs is **not recommended**, except for bootstrap before transferring ownership.

**Emergency actions**
- If this key is compromised, transfer ownership, review and restore right configuration:
  ```solidity
  BribeFactoryUpgradeable.transferOwnership(newOwner);
  BribeFactoryUpgradeable.setRewardClaimPause(true);    // freeze reward claims
  BribeFactoryUpgradeable.setVoter(safeVoter);          // restore safe voter
  BribeFactoryUpgradeable.changeImplementation(safeImpl); // restore safe implementation
  ```
- Bribes deployed during compromise should be treated as unsafe; governance should migrate future incentives to new bribes created after ownership recovery.

---

## BribeUpgradeable

Bribe contract representing emission incentives for a specific pool.

Privileged control belongs to:

- Bribe Owner (resolved via `BribeFactory.bribeOwner()`)
- BribeFactory (same authority via `onlyAllowed`)
- Voter (vote accounting)
- Minter (epoch source)

---

### Bribe Owner (`owner()` via BribeFactory)

Final governance owner of each bribe instance.

**Capabilities**
- Manage reward-token list:  
  `addRewardToken`, `addRewardTokens`
- Recover ERC20 tokens:  
  `recoverERC20AndUpdateData`, `emergencyRecoverERC20`
- Update integrations linked to the bribe:  
  `setVoter`, `setMinter`

**Assign To**
- Governance / timelock / multisig (same entity as BribeFactory owner).

**Emergency actions**
- If this key is compromised:
  ```solidity
  BribeFactoryUpgradeable.setRewardClaimPause(true); // global freeze
  BribeUpgradeable.setVoter(safeVoter);              // restore safe integrations for every bribe contract
  BribeUpgradeable.setMinter(safeMinter);
  ```
---

## BribeVeNESTRewardToken

Intermediate ERC20 token (brVeNEST) that receives NEST and auto-converts to veNEST via VotingEscrow when transferred to non-whitelisted recipients.

---

### DEFAULT_ADMIN_ROLE

Top-level admin for this token and its lock configuration.

**Capabilities**
- Set or update `createLockParams` used when converting brVeNEST → veNEST (`updateCreateLockParams`).
- Grant or revoke `MINTER_ROLE` and `WHITELIST_ROLE`.

**Assign To**
- Governance / timelock / multisig.
- Direct assignment to EOAs is **not recommended**, except for bootstrap.

**Emergency actions**
- If this key is compromised:
  ```solidity
  // From a higher-level governance / AccessControl admin
  revokeRole(DEFAULT_ADMIN_ROLE, compromisedAdmin);
  grantRole(DEFAULT_ADMIN_ROLE, safeAdmin);

  // Reset minters and whitelist to trusted addresses
  revokeRole(MINTER_ROLE, compromisedMinter);
  revokeRole(WHITELIST_ROLE, compromisedWhitelisted);
  updateCreateLockParams(safeCreateLockParams);
  ```

---

### MINTER_ROLE

Role for entities allowed to mint brVeNEST in exchange for NEST.

**Capabilities**
- Mint brVeNEST by depositing underlying NEST:
  - `mint(to, amount)` transfers NEST from the minter to the contract and mints brVeNEST.

**Assign To**
- Reward distribution components (e.g. routers, bribe systems) that need to convert NEST into brVeNEST.

**Emergency actions**
- If this key is compromised:
  ```solidity
  // called by DEFAULT_ADMIN_ROLE
  revokeRole(MINTER_ROLE, compromisedMinter);
  ```
- Investigate and, if needed, withdraw excess underlying NEST from this contract and re-balance bribe allocations off-chain.

---

### WHITELIST_ROLE

Addresses exempt from automatic conversion when receiving brVeNEST.

**Capabilities**
- When a `WHITELIST_ROLE` address receives brVeNEST, the transfer does **not** trigger burning and conversion to veNEST.

**Assign To**
- System contracts or infrastructure that must temporarily hold brVeNEST (e.g. aggregators, routers, treasury).
- Avoid assigning broadly to EOAs; do so only for specific operational roles.

**Emergency actions**
- If a whitelisted address is compromised:
  ```solidity
  // called by DEFAULT_ADMIN_ROLE
  revokeRole(WHITELIST_ROLE, compromisedWhitelisted);
  ```
- Optionally rotate any sensitive infrastructure that relied on that address.

---

## CustomBribeRewardRouter

Router that converts NEST or veNEST into brVeNEST and sends it as rewards to external bribe contracts.

Relies on:

- `DEFAULT_ADMIN_ROLE` (AccessControl)
- Integration with `voter` and `bribeVeNestRewardToken`
- Per-function enable/disable via `funcEnabled`

---

### DEFAULT_ADMIN_ROLE

Primary admin for the router.

**Capabilities**
- Enable or disable specific functions via:
  - `setupFuncEnable(bytes4 selector, bool isEnable)`
- Assign or revoke any additional roles if extended in the future.
- Indirectly controls which flows users can execute (e.g. `notifyRewardNESTInVeNEST`, `notifyRewardVeNESTInVeNest`).

**Assign To**
- Governance / timelock / multisig.
- EOAs not recommended for long-term use.

**Emergency actions**
- If this key is compromised:
  ```solidity
  // immediately disable all critical entrypoints
  setupFuncEnable(ICustomBribeRewardRouter.notifyRewardNESTInVeNEST.selector, false);
  setupFuncEnable(ICustomBribeRewardRouter.notifyRewardVeNESTInVeNest.selector, false);

  // from higher-level governance, revoke and reassign DEFAULT_ADMIN_ROLE
  revokeRole(DEFAULT_ADMIN_ROLE, compromisedAdmin);
  grantRole(DEFAULT_ADMIN_ROLE, safeAdmin);
  ```

---


## NestRaiseUpgradeable

Manages a token raise with whitelist and public phases, and optional partial locking of rewards into veNFTs.

---

### Owner (Ownable2StepUpgradeable)

Top-level administrator for configuring the raise and withdrawing funds.

**Capabilities**
- Configure core parameters on initialization (via `initialize`), including:
  - `token`, `rewardToken`, `depositsReciever`, `amountOfRewardTokenPerDepositToken`,
  - `votingEscrow` (if `toVeNftPercentage > 0`), `toVeNftPercentage`.
- Update operational parameters:
  - Deposit caps: `setDepositCaps(totalDepositCap, whitelistCap, publicCap)`.
  - Whitelist root: `setWhitelistRoot(root)`.
  - Phase timings: `setTimestamps(startWhitelist, startPublic, endPublic, startClaim)`.
- Withdraw funds after the raise is finished:
  - User deposits: `whithdrawDeposits()`.
  - Excess/unclaimed reward tokens: `withdrawExcessiveRewardTokens()`.

**Assign To**
- Governance / timelock / multisig.
- Direct EOAs are **not recommended**, except as temporary bootstrap until ownership is transferred.

**Emergency actions**
- If this key is compromised:
  - Stop interacting with the raise (front-end and off-chain systems should block new user deposits if phases are still open).
  - Use higher-level governance or ProxyAdmin (if this contract is proxied) to:
    - Transfer ownership to a safe address, or
    - Upgrade to a new implementation that ignores instructions from the compromised owner.
  - After ownership is secured, review:
    - Caps and timestamps to ensure they have not been made malicious.
    - Final withdrawal destinations to confirm `depositsReciever` and reward flows are still correct.

---

## RNest

Non-upgradeable ERC20 token (rNEST) with burn-and-convert mechanics: converts rNEST into NEST and veNEST via VotingEscrow.

---

### Owner (Ownable2Step)

Sole privileged role with minting and recovery powers.

**Capabilities**
- Mint rNEST to specified addresses:
  - `mint(to, amount)`.
- Recover underlying NEST tokens held by the contract:
  - `recoverToken(amount)`.

**Assign To**
- Governance / treasury multisig with tight operational control.
- Direct EOAs are **not recommended** in production, as the owner can arbitrarily mint rNEST.

**Emergency actions**
- If this key is compromised:
  - Immediately stop treating rNEST as trusted collateral or accounting unit in all protocol components (UI, accounting, bribes, etc.).
  - Use higher-level governance (e.g. protocol admin / L2 governance) to:
    - Stop sending NEST into the RNest contract.
    - If possible, gate or blacklist RNest usage in dependent systems.

---

## TokenPublicRaiseUpgradeable

Fixed-rate public raise that accepts native currency (e.g. ETH) and records purchased token amounts per user.  
Does **not** transfer sale tokens itself, only accounts allocations for an external distribution process.

---

### Owner (Ownable2StepUpgradeable)

Admin role controlling the raise window, deposit limits, price, and treasury address.

**Capabilities**
- Initialize and configure the sale via `initialize` (start/end, limits, cap, price, treasury).
- Update:
  - Price: `setTokenPricePerOneNative(price)`.
  - Treasury address: `setTreasury(treasury)`.
  - Deposit limits: `setDepositLimits(min, maxPerUser, globalCap)`.
  - Raise window: `setRaiseWindow(start, end)`.
- Withdraw collected native currency after the raise:
  - `withdrawToTreasury()` to send funds to `treasury`.

**Assign To**
- Governance / timelock / multisig.
- Direct EOAs are **not recommended**, especially in production raises.

**Emergency actions**
- If this key is compromised:
  - Treat the current raise as potentially unsafe:
    - Stop promoting deposit addresses.
    - Front-end should prevent further user deposits (even if contract window is still “active” on-chain).
  - Use ProxyAdmin / protocol governance (if proxied) to:
    - Transfer ownership to a safe multisig, or
    - Upgrade to a new implementation with corrected parameters and locked owner logic.
  - After securing ownership:
    ```solidity
    setTreasury(safeTreasury);
    setDepositLimits(safeMin, safeMax, safeTotalCap);
    setRaiseWindow(safeStart, safeEnd);
    setTokenPricePerOneNative(safePrice);
    ```
  - If the malicious user may have changed `treasury`, verify and fix it before calling `withdrawToTreasury()`.


## VeBoostUpgradeable

Implements boosting logic for NEST deposits, distributing additional rewards and optional veNEST boosts based on parameters and external price feeds.

---

### Owner (Ownable2StepUpgradeable)

Primary admin controlling boost parameters, reward tokens, integrations, and token recovery.

**Capabilities**
- Configure core integrations:
  - Set USD/NEST price provider: `setPriceProvider(address)`.
- Configure boost parameters:
  - Set boost percentage: `setNESTBoostPercentage(uint256)`.
  - Set minimum USD amount to qualify for boosts: `setMinUSDAmount(uint256)`.
  - Set minimum lock time: `setMinLockedTime(uint256)`.
- Manage reward tokens:
  - Add reward token: `addRewardToken(address)`.
  - Remove reward token: `removeRewardToken(address)`.
- Recover arbitrary tokens held in the contract:
  - `recoverTokens(address token, uint256 amount)`.

**Assign To**
- Governance / timelock / multisig.
- Direct EOAs **not recommended**, given control over economic parameters and reward baskets.

**Emergency actions**
- If this key is compromised:
  ```solidity
  // frontends / off-chain systems should immediately stop routing new boost flows through this contract

  // Governance (via ProxyAdmin or similar) should transfer ownership or upgrade implementation:
  // 1. Transfer ownership to a safe multisig:
  //    VeBoostUpgradeable.transferOwnership(safeOwner);
  //    VeBoostUpgradeable.acceptOwnership(); // from safeOwner

  // 2. Reset integrations and parameters from safe owner:
  VeBoostUpgradeable.setPriceProvider(safePriceProvider);
  VeBoostUpgradeable.setNESTBoostPercentage(safeBoostPercentage);
  VeBoostUpgradeable.setMinUSDAmount(safeMinUSDAmount);
  VeBoostUpgradeable.setMinLockedTime(safeMinLockedTime);
  ```
- Review reward token balances and consider recovering them to a secure treasury via `recoverTokens` if needed.

---

## VeNestDistributorUpgradeable

Distributes veNEST by locking NEST in VotingEscrow on behalf of recipients, governed by whitelisted “reasons” and role-based access control.

---

### DEFAULT_ADMIN_ROLE

Top-level admin overseeing roles and whitelisted reasons.

**Capabilities**
- Grant/revoke `_DISTRIBUTOR_ROLE` and `WITHDRAWER_ROLE`.
- Manage whitelisted airdrop reasons:
  - `setWhitelistReasons(string[] reasons, bool[] isWhitelisted)`.

**Assign To**
- Governance / timelock / multisig.

**Emergency actions**
- If this key is compromised:
  ```solidity
  // called by higher-level governance if an AccessControl admin wrapper exists
  VeNestDistributorUpgradeable.revokeRole(DEFAULT_ADMIN_ROLE, compromisedAdmin);
  VeNestDistributorUpgradeable.grantRole(DEFAULT_ADMIN_ROLE, safeAdmin);

  // Clean up critical roles
  VeNestDistributorUpgradeable.revokeRole(DISTRIBUTOR_ROLE, compromisedDistributor);
  VeNestDistributorUpgradeable.revokeRole(WITHDRAWER_ROLE, compromisedWithdrawer);
  ```

---

### DISTRIBUTOR_ROLE

Role allowed to perform veNEST airdrops (i.e., lock NEST on behalf of recipients).

**Capabilities**
- Execute airdrops:
  - `distributeVeNest(reason, AidropRow[] rows)` which:
    - Locks NEST for each recipient in VotingEscrow via `createLockFor`.
    - Emits per-recipient and aggregate events.

**Assign To**
- Airdrop orchestration services / backend systems controlled by protocol.
- Multisigs or specialized distributor contracts.
- EOAs acceptable if strictly used for scripted airdrops and rotated regularly.

**Emergency actions**
- If this key is compromised:
  ```solidity
  // called by DEFAULT_ADMIN_ROLE
  VeNestDistributorUpgradeable.revokeRole(_DISTRIBUTOR_ROLE, compromisedDistributor);
  ```

---

### WITHDRAWER_ROLE

Role allowed to recover tokens from the distributor.

**Capabilities**
- Recover arbitrary ERC20 tokens from the contract:
  - `recoverTokens(address token, uint256 amount)`.

**Assign To**
- Treasury / operations multisig.

**Emergency actions**
- If this key is compromised:
  ```solidity
  // called by DEFAULT_ADMIN_ROLE
  VeNestDistributorUpgradeable.revokeRole(WITHDRAWER_ROLE, compromisedWithdrawer);
  ```
---

## PerpetualsGaugeUpgradeable

Gauge contract for perpetuals rewards, routing reward tokens to a downstream `rewarder` contract.

---

### Owner (OwnableUpgradeable)

Top-level admin of the perpetuals gauge.

**Capabilities**
- Owns general administrative authority over this gauge instance (future extensions)..

**Assign To**
- Governance / timelock / multisig.
- EOAs **not recommended** beyond bootstrap.

**Emergency actions**
- If this key is compromised:
  - Treat this gauge as untrusted and plan to:
    - Stop routing rewards to it from the main Voter or distribution logic.
    - Replace it with a freshly deployed, safe gauge wired via governance.
  - If proxied, governance can upgrade the implementation or move to a new proxy.

---

### DISTRIBUTION (authorized distributor address)

Dedicated address allowed to send rewards into the gauge.

**Capabilities**
- Can call:
  - `notifyRewardAmount(rewardToken, amount)` to move reward tokens from `DISTRIBUTION` into the gauge, then into the `rewarder`.

**Assign To**
- Trusted distribution source:
  - Typically a Voter or reward distributor contract.

### rewarder (RewardReciever contract)

Downstream contract that actually allocates rewards to traders.

**Capabilities**
- Receives approved reward tokens from the gauge via:
  - `rewarder.notifyRewardAmount(token, amount)`.

**Assign To**
- A vetted `PerpetualsTradersRewarder` implementation controlled by the protocol.

**Emergency actions**
- If the rewarder contract is found to be unsafe:
  - Stop calling `notifyRewardAmount` by:
    - Updating distribution logic to bypass this gauge, or
    - Replacing the gauge and wiring it to a new `rewarder`.
  - Governance should treat any rewards routed to the old rewarder as at-riskю

---

## PerpetualsTradersRewarderUpgradeable

Rewarder that holds reward tokens for perpetual traders and allows users to claim based on signed EIP-712 messages.

---

### Owner (OwnableUpgradeable)

Admin that controls `signer` and overall rewarder configuration.

**Capabilities**
- Set the `signer` address:
  - `setSigner(address signer_)`.

**Assign To**
- Governance / timelock / multisig.

**Emergency actions**
- If this key is compromised:
  ```solidity
  // From safe governance context (e.g. via proxy/admin pattern)
  PerpetualsTradersRewarderUpgradeable.setSigner(address(0)); // immediately disable claims
  PerpetualsTradersRewarderUpgradeable.transferOwnership(newOwner)
  // After ownership transfer to a safe admin:
  PerpetualsTradersRewarderUpgradeable.setSigner(newSafeSigner); // re-enable under new key
  ```
- Consider treating existing signatures as unsafe and/or issuing a new distribution model if abuse is detected.

---

### signer (authorized off-chain address)

EIP-712 signer that authorizes claims for users.

**Capabilities**
- Signs `Message(user, amount)` for users to claim rewards.
- Contract verifies signatures via EIP-712 and ensures `recover(digest, signature) == signer`.

**Assign To**
- Backend / rewards service key (HSM / hardware wallet).
- EOAs acceptable but must be tightly secured and rotated on suspicion.

**Emergency actions**
- If compromised:
  ```solidity
  // called by Owner
  PerpetualsTradersRewarderUpgradeable.setSigner(address(0)); // disable new claims
  // later, once new key is secured:
  PerpetualsTradersRewarderUpgradeable.setSigner(newSafeSigner);
  ```
- Any suspected fraudulent claims should be handled via governance processes (e.g. additional grants or clawbacks if possible).

---

### gauge (integration address on PerpetualsTradersRewarderUpgradeable)

Gauge contract authorized to fund the rewarder.

**Capabilities**
- Only `gauge` may call:
  - `notifyRewardAmount(token, rewardAmount)` to transfer rewards into the rewarder.

**Assign To**
- The `PerpetualsGaugeUpgradeable` or similar gauge contract.

**Emergency actions**
- If the gauge is compromised or replaced:
  - Governance should update the distribution flow to stop using the compromised gauge.
  - If proxied, migrate to a new rewarder that trusts a new `gauge` address.

---

## GaugeUpgradeable

General-purpose gauge contract for LP tokens, distributing rewardToken emissions and forwarding fees to bribe contracts. Controlled by `gaugeOwner()` via the GaugeFactory.

---

### Gauge Owner (via IGaugeFactory.gaugeOwner())

Owner managed at the GaugeFactory level.

**Capabilities**
- Update key integrations:
  - Distribution address: `setDistribution(address)`.
  - Merkl/Blaze middleman: `setMerklGaugeMiddleman(address)`.
  - Toggle Merkl/Blaze emission routing: `setIsDistributeEmissionToMerkle(bool)`.
  - Gauge rewarder: `setGaugeRewarder(address)`.
  - Fee vault: `setFeeVault(address)`.
  - Internal bribe contract: `setInternalBribe(address)`.
- Activate / stop emergency mode:
  - `activateEmergencyMode()`, `stopEmergencyMode()`.

**Assign To**
- Governance / timelock / multisig (as defined by `GaugeFactory.gaugeOwner()`).

**Emergency actions**
- If this key is compromised, the response depends on the observed damage:
  - Transfer ownership to new on gauge factory, upgrade from ProxyAdmin, if leak access. 
  - If integrations / parameters were changed but funds are not at immediate risk:
    ```solidity
    // via GaugeFactory / governance, rotate ownership to a safe multisig
    // then, from the new Gauge Owner, restore integrations:
    GaugeUpgradeable.setDistribution(safeDistribution);
    GaugeUpgradeable.setMerklGaugeMiddleman(safeMerklMiddleman);
    GaugeUpgradeable.setGaugeRewarder(safeGaugeRewarder);
    GaugeUpgradeable.setFeeVault(safeFeeVault);
    GaugeUpgradeable.setInternalBribe(safeInternalBribe);
    ```
  - If there is concern about LP funds (suspicious changes, active exploits, etc.):
    ```solidity
    // from the new Gauge Owner (after rotating ownership)
    GaugeUpgradeable.activateEmergencyMode(); // allow users to exit via emergencyWithdraw
    ```
    Off-chain, instruct users to use `emergencyWithdraw` / `emergencyWithdrawAmount` to pull out their LP positions until the situation is resolved.


---

### DISTRIBUTION (on GaugeUpgradeable)

Authorized distribution address for reward emissions.

**Capabilities**
- Call `notifyRewardAmount(rewardToken, reward)` to send emissions into the gauge.
- Forwards emissions to Merkl middleman (if enabled) or keeps them in the gauge for time-based distribution.

**Assign To**
- Voter / main emissions distribution contract.

**Emergency actions**
- If compromised:
  - Governance should:
    - Stop using that address in all distribution flows.
    - From Gauge Owner, set a new distribution contract:
      ```solidity
      GaugeUpgradeable.setDistribution(safeDistribution);
      ```

---

### gaugeRewarder (IRewarder integration)

Optional integration for additional per-user reward logic.

**Capabilities**
- Called on deposit/withdraw/harvest:
  - `IRewarder.onReward(user, user, balance)`.

**Assign To**
- A rewarder contract (e.g., a PerpetualsTradersRewarder contract).
---


## GaugeFactoryUpgradeable

Factory responsible for deploying GaugeUpgradeable contracts and holding the shared “gauge owner” role.

---

### Owner (OwnableUpgradeable)

Factory admin that controls deployment and global parameters shared by gauges.

**Capabilities**
- Initialize core parameters:
  - `initialize(voter, gaugeImplementation, merklGaugeMiddleman)`.
- Deploy new gauges:
  - `createGauge(...)` (only `voter` or `owner`).
- Update implementation and Merkl integration:
  - `changeImplementation(address)`
  - `setMerklGaugeMiddleman(address)`
- Provides the shared gauge owner:
  - `gaugeOwner()` returns `owner()` (used by gauges to check ownership).

**Assign To**
- Governance / timelock / multisig.

**Emergency actions**
- Transfer ownership to new gauge factory owner wallet/multisign/timelock
- If this key is compromised:
  ```solidity
  // 1. Stop creating new gauges from compromised factory.
  // 2. From new secure owner (after governance fix):
  GaugeFactoryUpgradeable.changeImplementation(safeGaugeImpl);
  GaugeFactoryUpgradeable.setMerklGaugeMiddleman(safeMiddleman);
  ```
- Gauges already deployed using this factory will still see `gaugeOwner()` as the factory owner, so ownership recovery at the factory level is critical for all existing gauges.


## FeesVaultFactoryUpgradeable

Factory for creating `FeesVaultUpgradeable` instances and configuring distribution logic for protocol fees.

---

### DEFAULT_ADMIN_ROLE

Top‑level admin for the FeesVault factory.

**Capabilities**
- Update global integrations:
  - `setVoter(address)` – voter used to validate gauge callers.
  - `changeImplementation(address)` – implementation used by FeesVaultProxy.
- Manage creators:
  - `changeCreatorForFeesVaults(address creator, address[] vaults)`.

**Assign To**
- Governance / timelock / multisig.
- EOAs **not recommended**.

**Emergency actions**
- If this key is compromised:
  ```solidity
  // After regaining control via governance / proxy admin:
  FeesVaultFactoryUpgradeable.changeImplementation(safeFeesVaultImpl);
  FeesVaultFactoryUpgradeable.setVoter(safeVoter);
  ```
- Audit creator mappings and reassign safe creators if needed.

---

### FEES_VAULT_ADMINISTRATOR_ROLE

Admin responsible for configuring fee distribution rules.

**Capabilities**
- Set global default distribution:
  - `setDefaultDistributionConfig(config)`.
- Set per‑vault custom distributions:
  - `setCustomDistributionConfig(vault, config)`.
- Set distribution config per creator:
  - `setDistributionConfigForCreator(creator, config)`.

**Assign To**
- Treasury/Governance/Multisig.
- EOAs strongly discouraged.

**Emergency actions**
- If compromised:
  ```solidity
  FeesVaultFactoryUpgradeable.revokeRole(FEES_VAULT_ADMINISTRATOR_ROLE, compromised);
  FeesVaultFactoryUpgradeable.grantRole(FEES_VAULT_ADMINISTRATOR_ROLE, safeAdmin);
  ```
- Reset unsafe distribution configs.

---

### WHITELISTED_CREATOR_ROLE

Creators who are allowed to deploy new fee vaults.

**Capabilities**
- Create vaults:
  - `createVaultForPool(pool)`.

**Assign To**
- Dex V2/V3 Pair Factory,  contract or protocol‑controlled multisigs/systems.

**Emergency actions**
- If compromised:
  ```solidity
  FeesVaultFactoryUpgradeable.revokeRole(WHITELISTED_CREATOR_ROLE, compromisedCreator);
  ```
- Treat vaults created by compromised keys as unsafe and avoid routing fees to them.

---

### CLAIM_FEES_CALLER_ROLE

Allows callers to trigger fee distribution when gauge‑based flow is not used.

**Capabilities**
- Call `FeesVaultUpgradeable.claimFees()` when `toGaugeRate == 0`.

**Assign To**
- Backends, cron jobs, protocol fee distribution bots.
- EOAs allowed if monitored.

**Emergency actions**
- If compromised:
  ```solidity
  FeesVaultFactoryUpgradeable.revokeRole(CLAIM_FEES_CALLER_ROLE, compromisedCaller);
  ```
- Review recent fee distributions for unexpected transfers.

---

## FeesVaultUpgradeable

Vault aggregating pool fees and redistributing them to gauge and recipient addresses according to configuration.

---

### FEES_VAULT_ADMINISTRATOR_ROLE (checked on factory)

Role used to perform emergency ERC20 recovery.

**Capabilities**
- Recover arbitrary ERC20 from the vault:
  - `emergencyRecoverERC20(token, amount)`.

**Assign To**
- Treasury / ops multisig.

**Emergency actions**
- If compromised:
  ```solidity
  // On the factory contract
  FeesVaultFactoryUpgradeable.revokeRole(FEES_VAULT_ADMINISTRATOR_ROLE, compromised);
  ```
- Track recovered amounts and remediate via governance if needed.

---

### claimFees Callers (gauge path or CLAIM_FEES_CALLER_ROLE)

Two types of authorized callers:

1. **Gauge callers** — when `toGaugeRate > 0`  
   Must be:
   - A valid gauge (`voter.isGauge(msg.sender)`), and  
   - Gauge must correspond to this vault’s pool (`poolForGauge(msg.sender)`).

2. **Manual callers** — when `toGaugeRate == 0`  
   Must hold `CLAIM_FEES_CALLER_ROLE` on the factory.

**Capabilities**
- Trigger fee distribution:
  - To gauge.
  - To configured recipients.

**Assign To**
- Gauge flow: protocol gauges.
- Manual flow: protocol‑controlled distribution jobs.

**Emergency actions**
- If misused:
  ```solidity
  FeesVaultFactoryUpgradeable.revokeRole(CLAIM_FEES_CALLER_ROLE, compromised);
  FeesVaultFactoryUpgradeable.setVoter(safeVoter);
  ```
- If a gauge is compromised, governance should kill it at the Voter so it fails `isGauge()` validation.



## Pair

Core DEX V2 pool (stable/volatile) with fee accounting, oracle observations, swaps, and fee routing to PairFees and community vaults.

The Pair contract itself has **no roles**, but enforces access control indirectly through:

- `factory` (PairFactoryUpgradeable)
- `PairFactory.PAIRS_ADMINISTRATOR_ROLE` (for communityVault management)

---

### PAIRS_ADMINISTRATOR_ROLE (via PairFactory, for setCommunityVault)

Used to control `communityVault` address on the Pair.

**Capabilities**
- Call `Pair.setCommunityVault(address)` (only if caller has `PAIRS_ADMINISTRATOR_ROLE` on factory).
- This affects where protocol fees for the pair are sent.

**Assign To**
- Governance / treasury multisig.

**Emergency actions**
- If a PAIRS_ADMINISTRATOR_ROLE key is compromised:
  ```solidity
  // On PairFactoryUpgradeable, called by DEFAULT_ADMIN_ROLE
  PairFactoryUpgradeable.revokeRole(PAIRS_ADMINISTRATOR_ROLE, compromisedAdmin);
  PairFactoryUpgradeable.grantRole(PAIRS_ADMINISTRATOR_ROLE, safeAdmin);
  ```
- From the safe admin, reset `communityVault` for affected pairs.

---

## PairFactoryUpgradeable

Factory managing creation of pairs, their default fee parameters, protocol fee share, dynamic fee modules, and community vault integration.

---

### DEFAULT_ADMIN_ROLE

Top-level admin for all factory roles and configs.

**Capabilities**
- Grant/revoke:
  - `PAIRS_ADMINISTRATOR_ROLE`
  - `FEES_MANAGER_ROLE`
  - `PAIRS_CREATOR_ROLE`
- Set global implementation and upgrade pairs to a new implementation:
  - `initialize(implementation, communityVaultFactory)`
  - `upgradePairImplementation(implementation)`
- Set `communityVaultFactory`:
  - `setCommunityVaultFactory(address)`.

**Assign To**
- Governance / timelock / multisig.
- EOAs should not hold this long-term.

**Emergency actions**
- If this key is compromised:
  ```solidity
  // via governance/proxy-admin after regaining control
  PairFactoryUpgradeable.revokeRole(PAIRS_ADMINISTRATOR_ROLE, compromisedAdmin);
  PairFactoryUpgradeable.revokeRole(FEES_MANAGER_ROLE, compromisedFeesMgr);
  PairFactoryUpgradeable.revokeRole(PAIRS_CREATOR_ROLE, compromisedCreator);
  PairFactoryUpgradeable.grantRole(DEFAULT_ADMIN_ROLE, safeAdmin);
  ```
- Replace `implementation` and `communityVaultFactory` with safe addresses, and then restrict new pair creation and fee changes to trusted actors only.

---

### PAIRS_ADMINISTRATOR_ROLE

Admin for operational controls around pairs, pausing, and creation mode.

**Capabilities**
- Pause/unpause swaps:
  - `setPause(bool)`
- Control public pool creation mode:
  - `setIsPublicPoolCreationMode(bool)`
- Set `communityVaultFactory`:
  - `setCommunityVaultFactory(address)`

**Assign To**
- Protocol operations / risk multisig.

**Emergency actions**
- If this key is compromised:
  ```solidity
  PairFactoryUpgradeable.revokeRole(PAIRS_ADMINISTRATOR_ROLE, compromisedAdmin);
  PairFactoryUpgradeable.grantRole(PAIRS_ADMINISTRATOR_ROLE, safeAdmin);
  ```
- Verify `isPaused`, `isPublicPoolCreationMode` and `communityVaultFactory` have not been set to malicious values, then correct as needed.

---

### FEES_MANAGER_ROLE

Role controlling swap fee parameters and protocol fee split.

**Capabilities**
- Set global protocol fee:
  - `setProtocolFee(uint256)`
- Set custom protocol fee per pair:
  - `setCustomProtocolFee(address pair, uint256)`
- Set base fee per pair:
  - `setCustomFee(address pair, uint256)`
- Set global stable/volatile fees:
  - `setFee(bool stable, uint256 fee)`

**Assign To**
- Treasury / operations multisig responsible for fee policy.

**Emergency actions**
- If this key is compromised:
  ```solidity
  PairFactoryUpgradeable.revokeRole(FEES_MANAGER_ROLE, compromisedFeesMgr);
  PairFactoryUpgradeable.grantRole(FEES_MANAGER_ROLE, safeFeesMgr);
  ```
- Review `getFee` / `getProtocolFee` behaviour by checking:
  - `_customFee[pair]`
  - `_customProtocolFee[pair]`
  and reset to safe values if attacker modified them.

---

### PAIRS_CREATOR_ROLE

Role allowed to create new pairs when `isPublicPoolCreationMode == false`.

**Capabilities**
- Create new pairs via:
  - `createPair(tokenA, tokenB, bool stable)`.

**Assign To**
- Router / pool manager contracts, or a very small set of multisigs, EOAs under strict control.

**Emergency actions**
- If this key is compromised:
  ```solidity
  PairFactoryUpgradeable.revokeRole(PAIRS_CREATOR_ROLE, compromisedCreator);
  ```
- Treat any newly created pairs as suspect; ignore them in routers and frontends until manually reviewed.

---

### Dynamic Fee Module (customVolatileDynamicFeeModule)

Optional plugin contract that provides per-pair dynamic volatile fee.

**Capabilities**
- For a pair with a module set:
  - `getFee(pair, false)` may call the module’s `getFee(pair)` if `isEnable()` returns true.

**Assign To**
- Contracts such as `VolatileDynamicFeeOnePool` (per-pair modules).

**Emergency actions**
- If a dynamic fee module is unsafe:
  - From `FEES_MANAGER_ROLE` or `DEFAULT_ADMIN_ROLE`, reset module to zero or safe one:
    ```solidity
    PairFactoryUpgradeable.setCustomVolatileDynamicFeeModule(pair, address(0));
    ```

---

## VolatileDynamicFeeOnePool

Dynamic fee module for a **single pair**, with decreasing fee schedule over time.

---

### Owner (OwnableUpgradeable)

Admin that controls dynamic fee schedule parameters.

**Capabilities**
- Initialize module with parameters bound to one `pair`.
- Update `startTimestamp` via:
  - `setStartTimestamp(uint256)`.

**Assign To**
- Governance / timelock / multisig.
- EOAs are acceptable, but multisigs are preferred.

**Emergency actions**
- If this key is compromised:
  - PairFactory can be configured to ignore this module:
    ```solidity
    PairFactoryUpgradeable.setCustomVolatileDynamicFeeModule(pair, address(0));
    ```
  - Optionally deploy a new fee module with correct parameters and attach it via `setCustomVolatileDynamicFeeModule`.

## ManualNESTPriceProvider

Manual on-chain price provider for NEST, returning the price of 1 USD in NEST tokens.

---

### Owner (Ownable)

Single admin controlling the manually set price.

**Capabilities**
- Set NEST price in terms of USD:
  - `setNestPrice(uint256 price_)`.

**Assign To**
- Governance / timelock / multisig, if the price is safety-critical in production.
- For testing or non-critical environments, an EOA is acceptable but should be protected.

**Emergency actions**
- If this key is compromised:
  - Assume future prices are untrusted and disable any logic that depends on this price feed.
  - Governance should:
    - Deploy a new price provider contract with a safe owner.
    - Update all integrations (e.g., VeBoost, other components) to use the new provider address.

---

## MerklGaugeMiddleman

Middleman contract between gauges and the Merkl `DistributionCreator`, managing reward distributions to Merkl.

---

### Owner (Ownable)

Administrator controlling which gauges can use this middleman and how.

**Capabilities**
- Set or update Merkl distribution parameters for a gauge:
  - `setGauge(gauge, DistributionParameters params)`.

**Assign To**
- Governance / operations multisig.
- EOAs are **not recommended** in production since misconfiguration can redirect rewards.

**Emergency actions**
- If this key is compromised:
  - Stop routing new emissions to this Merkl middleman from upstream contracts (e.g., gauges) at the protocol level.
  - Deploy a new `MerklGaugeMiddleman` with:
    - Correct `token` and `merklDistributionCreator`.
    - Safe configuration for gauges.
  - Migrate gauge → middleman references (e.g., via `GaugeUpgradeable.setMerklGaugeMiddleman(newMiddleman)` from gauge owner).

---


### merklDistributionCreator

Merkl `DistributionCreator` instance this middleman talks to.

**Capabilities**
- Receives distributions via `createDistribution(params)`.

**Assign To**
- Official Merkl `DistributionCreator` contract for the deployment.

**Emergency actions**
- If the Merkl instance is compromised:
  - Stop using the middleman.
  - Deploy a replacement Merkl stack and new middleman.

---

## OpenOceanVeNftDirectBuyer

Helper contract that:
- Swaps user’s tokens via OpenOcean.
- Uses received NEST (or target token) to create veNFTs in VotingEscrow.

---

### Owner (Ownable)

Only admin capable of rescuing stuck funds.

**Capabilities**
- Rescue ERC20 tokens (or ETH if treated as such) from the contract:
  - `rescueFunds(IERC20 token)`.

**Assign To**
- Treasury / operations multisig / EOAs.

**Emergency actions**
- If this key is compromised:
  - Assume all funds in the contract are at risk; governance should:
    - Stop using this direct buyer in UIs and automation.
    - If necessary, deploy a new `OpenOceanVeNftDirectBuyer` with a safe owner and updated routing.

---

## MinimalLinearVestingUpgradeable

Manages linear vesting of a token with per-wallet allocations and a global vesting schedule.

---

### Owner (OwnableUpgradeable)

Admin defining vesting parameters and allocations.

**Capabilities**
- Initialize token, start timestamp, and duration:
  - `initialize(token, startTimestamp, duration)`.
- Set allocations for wallets (before vesting start):
  - `setWalletsAllocation(wallets[], amounts[])`.
- Update vesting parameters (before vesting start):
  - `setVestingParams(startTimestamp, duration)`.

**Assign To**
- Governance / operations multisig.
- EOAs acceptable for small, restricted vesting deployments, but not ideal.

**Emergency actions**
- If this key is compromised *before* claim phase:
  - Immediately stop relying on this schedule for critical distributions.
  - Use governance to:
    - Deploy a new vesting contract.
    - Migrate or mirror correct allocations where feasible.
- If compromised *after* claim phase started:
  - Owner cannot modify allocations or parameters (protected by `onlyNotDuringClaimPhase`), so damage scope is limited.
  - Governance should still consider migrating future vesting programs to a new contract under safe ownership.

---

## VeNFTAPIUpgradeable

Read-only aggregation and analytics contract for veNFTs, APR, strategy rewards, etc.  
This contract does **not** move funds; it only reads from other contracts.

---

### Owner (OwnableUpgradeable)

Admin controlling which core contracts the API queries.

**Capabilities**
- Set managed NFT manager:
  - `setManagedNFTManager(address)`.
- Set voter:
  - `setVoter(address)` — implicitly updates `ve` and `underlyingToken` references based on the Voter.
- Set pair API integration:
  - `setPairAPI(address)`.

**Assign To**
- Governance or off-chain operations multisig.
- EOAs acceptable, since this contract is read-only and doesn’t hold funds.

**Emergency actions**
- If this key is compromised:
  - The direct risk is limited to incorrect view data (not funds).
  - Governance should:
    - Update `managedNFTManager`, `voter`, and `pairAPI` back to correct values.
    - Deploy a new VeNFTAPI if needed and route off-chain tooling to the new address.

## GetInformationAggregatorUpgradeable

Read-only aggregation helper that queries Voter, VotingEscrow, PairFactory and ManagedNFTManager to produce vote/epoch reports.  
Has a minimal on-chain registry of core contract addresses.

---

### owner (immutable)

Single admin for the address registry.

**Capabilities**
- Update core contract addresses used by the aggregator:
  - `updateAddress(AddressKey[] keys, address[] values)` for:
    - `VOTING_ESCROW`
    - `VOTER`
    - `PAIR_FACTORY`
    - `MANAGED_NFT_MANAGER`

**Assign To**
- Governance / timelock / multisig that manages protocol-wide addresses / EOAs.
- EOAs acceptable since contract is read-only and does not move funds, but a compromised owner can return bogus data.

**Emergency actions**
- If this key is compromised:
  - Treat data from this aggregator as **untrusted** (all registry entries may be poisoned).
  - Deploy a new `GetInformationAggregatorUpgradeable` with:
    - Correct `owner` (governance multisig),
    - Correct `registry` mappings for Voter, VotingEscrow, PairFactory, ManagedNFTManager.
  - Update off-chain tooling and UI to query the new aggregator address only.

---

## PairAPIUpgradeable

Read-only API over V2 and V3/CL pairs, gauges, reserves, fees, bribes and per-account balances.

---

### Owner (OwnableUpgradeable)

Admin controlling which Voter / PairFactory this API works with.

**Capabilities**
- Initialize references via `initialize(voter)` (once).
- Update the Voter and derived integrations:
  - `setVoter(address voter_)` — updates:
    - `voter`
    - `pairFactory` (`voter.v2PoolFactory()`)
    - `underlyingToken` (`IVotingEscrow(voter.votingEscrow()).token()`)

**Assign To**
- Governance or backend operations multisig responsible for analytics.
- EOAs acceptable since contract is read-only and does not move funds, but a compromised owner can return bogus data.

**Emergency actions**
- If this key is compromised:
  - Off-chain consumers should treat API results as untrusted until fixed.
  - Governance should:
    - Transfer ownership to a safe multisig (via proxy admin if upgradeable).
    - From safe owner, reset the Voter to the correct address:
      ```solidity
      PairAPIUpgradeable.setVoter(safeVoter);
      ```
  - If needed, deploy a new `PairAPIUpgradeable` with correct configuration and route all analytics to the new address.

---

## RewardAPIUpgradeable

Read-only API that aggregates emission rewards and bribe rewards (internal + external) for pairs and users.

---

### Owner (OwnableUpgradeable)

Admin controlling Voter reference and the `notReward` filter list.

**Capabilities**
- Initialize references via `initialize(voter)` (once).
  - Sets `voter`, `pairFactory`, and `underlyingToken`.
- Update Voter and derived integrations:
  - `setVoter(address voter_)` — updates:
    - `voter`
    - `pairFactory` (`voter.v2PoolFactory()`)
    - `underlyingToken` (`IVotingEscrow(voter.votingEscrow()).token()`)
- Manage tokens excluded from reward calculations:
  - `addNotReward(address token)` — mark token as ignored in reward views.
  - `removeNotReward(address token)` — re-enable token in reward views.

**Assign To**
- Governance / analytics / backend multisig.
- EOAs acceptable, but a compromised owner can manipulate which tokens show up as “rewards” in the API.

**Emergency actions**
- If this key is compromised:
  - Treat computed rewards from this API as untrusted.
  - Governance should:
    - Transfer ownership to a safe address (via proxy admin if upgradeable).
    - From safe owner:
      ```solidity
      RewardAPIUpgradeable.setVoter(safeVoter);
      // Reset notReward mapping off-chain and reconfigure:
      RewardAPIUpgradeable.removeNotReward(maliciouslyHiddenToken);
      ```
  - If the damage is unclear, deploy a new `RewardAPIUpgradeable` with a clean `notReward` list and correct Voter, and migrate all off-chain consumers to the new instance.


## BaseManagedNFTStrategyUpgradeable (abstract)

Base contract for managed NFT strategies. It does **not** define its own roles, but relies entirely on `ManagedNFTManagerUpgradeable` for access control.

### Effective Roles (via ManagedNFTManager)

- **Admin** — `managedNFTManager.isAdmin(msg.sender)`
- **Authorized User** — `managedNFTManager.isAuthorized(managedTokenId, msg.sender)`
- **ManagedNFTManager** — the manager contract itself

**Capabilities (when called through these roles)**
- `onlyManagedNFTManager`:
  - Internal management callbacks only the manager can invoke.
- `onlyAdmin`:
  - Set strategy name, description, creator.
  - Attach `managedTokenId` via `attachManagedNFT`.
- `onlyAuthorized`:
  - Execute `vote()` on behalf of the managed token.
  - Call `claimRewards()` and `claimBribes()` for the managed token.

**Assign To**
- Admin / authorized users are managed by `ManagedNFTManagerUpgradeable` (see below).

**Emergency actions**
- If a strategy behaves incorrectly due to compromised admin/authorized accounts:
  - Use `ManagedNFTManagerUpgradeable` to:
    - Rotate `authorizedUser` for `managedTokenId`.
    - Disable the managed NFT (`toggleDisableManagedNFT`) if needed.
    - Adjust strategy flags to limit risky capabilities.

---

## ManagedNFTManagerUpgradeable

Central manager for managed NFTs and their strategies. Controls creation, flags, authorized users, and detachment lock behaviour.

---

### DEFAULT_ADMIN_ROLE

Top-level admin of the manager.

**Capabilities**
- Grant/revoke `MANAGED_NFT_ADMIN`.
- Set global detachment lock duration:
  - `setDefaultDetachmentLockDuration(uint256)`.

**Assign To**
- Governance / timelock / multisig.
- EOAs not recommended.

**Emergency actions**
- If this key is compromised:
  ```solidity
  ManagedNFTManagerUpgradeable.revokeRole(MANAGED_NFT_ADMIN, compromisedAdmin);
  ManagedNFTManagerUpgradeable.grantRole(DEFAULT_ADMIN_ROLE, safeAdmin);
  // Optionally:
  ManagedNFTManagerUpgradeable.setDefaultDetachmentLockDuration(safeDuration);
  ```

---

### MANAGED_NFT_ADMIN

Admin role for creating managed NFTs, assigning authorized users, and managing strategy flags.

**Capabilities**
- Create managed NFTs and attach to strategies:
  - `createManagedNFT(address strategy)`.
- Set strategy flags:
  - `setStrategyFlags(strategy, flags)`.
- Manage authorized users for each managed token:
  - `setAuthorizedUser(managedTokenId, authorizedUser)`.
- Enable/disable managed NFTs:
  - `toggleDisableManagedNFT(managedTokenId)`.
- Whitelist specific NFTs:
  - `setWhitelistedNFT(tokenId, bool)`.

**Assign To**
- Strategy governance / protocol ops multisig.
- EOAs strongly discouraged.

**Emergency actions**
- If compromised:
  ```solidity
  // called by DEFAULT_ADMIN_ROLE
  ManagedNFTManagerUpgradeable.revokeRole(MANAGED_NFT_ADMIN, compromisedAdmin);
  ManagedNFTManagerUpgradeable.grantRole(MANAGED_NFT_ADMIN, safeAdmin);
  ```
- Review and correct:
  - `managedTokensInfo` (disabled status, authorized user).
  - `getStrategyFlags(strategy)` for all active strategies.

---


## CompoundVeNESTManagedNFTStrategyFactoryUpgradeable

Factory for deploying `CompoundVeNESTManagedNFTStrategyUpgradeable` + virtual rewarder pairs via proxies.

---

### DEFAULT_ADMIN_ROLE

Top-level admin for the factory.

**Capabilities**
- Grant/revoke `STRATEGY_CREATOR_ROLE`.
- Update implementation addresses:
  - `changeStrategyImplementation(address)`
  - `changeVirtualRewarderImplementation(address)`
- Set Router V2 Path Provider:
  - `setRouterV2PathProvider(address)`.

**Assign To**
- Governance / timelock / multisig.

**Emergency actions**
- If this key is compromised:
  ```solidity
  CompoundVeNESTManagedNFTStrategyFactoryUpgradeable.revokeRole(STRATEGY_CREATOR_ROLE, compromisedCreator);
  CompoundVeNESTManagedNFTStrategyFactoryUpgradeable.changeStrategyImplementation(safeStrategyImpl);
  CompoundVeNESTManagedNFTStrategyFactoryUpgradeable.changeVirtualRewarderImplementation(safeRewarderImpl);
  CompoundVeNESTManagedNFTStrategyFactoryUpgradeable.setRouterV2PathProvider(safePathProvider);
  ```

---

### STRATEGY_CREATOR_ROLE

Role allowed to create new strategies and virtual rewarders.

**Capabilities**
- Deploy new strategy + rewarder pair:
  - `createStrategy(string name)`.

**Assign To**
- Governance / protocol deployment multisig.
- EOAs acceptable if rotated and monitored, but best kept in multisig.

**Emergency actions**
- If compromised:
  ```solidity
  CompoundVeNESTManagedNFTStrategyFactoryUpgradeable.revokeRole(STRATEGY_CREATOR_ROLE, compromisedCreator);
  ```
- Consider ignoring any strategies created during the compromise unless audited.

---

## CompoundVeNESTManagedNFTStrategyUpgradeable

Concrete managed NFT strategy including:
- BaseManagedNFTStrategy privileges (via ManagedNFTManager),
- Single-token buyback logic,
- veNFT compounding and reward routing.

Access is controlled via:

- `ManagedNFTManagerUpgradeable` (admin & authorized user),
- Strategy flags from `ManagedNFTManager`,
- Buyback permissions via `_checkBuybackSwapPermissions`.

---

### Admin (via ManagedNFTManager.isAdmin)

Admin defined by the manager, not by the strategy itself.

**Capabilities**
- Attach managed NFT (indirectly via manager).
- Change strategy metadata:
  - `setName`, `setCreator`, `setDescription` (in base).
- Configure per-strategy detachment lock:
  - `setDetachmentLockDuration(uint256)`.
- Update Router V2 Path Provider:
  - `setRouterV2PathProvider(address)`.

**Assign To**
- Set via `ManagedNFTManager.setStrategyFlags` / `setAuthorizedUser` / internal governance processes.

**Emergency actions**
- If an admin key is misused:
  - From `ManagedNFTManager`, rotate admin/authorized accounts.
  - Optionally disable the managed NFT with `toggleDisableManagedNFT(managedTokenId)`.
  - Reset `detachmentLockDuration` and flags to safe defaults.

---

### Authorized User (via ManagedNFTManager.isAuthorized)

Per-managed-token authorized operator.

**Capabilities**
- Call `vote` for the managed NFT.
- Trigger:
  - `compoundVeNFTsAll`,
  - `compoundVeNFTs`,
  - `compound` (depending on strategy flags).
- Use recovery helpers (`claimBribesWithTokensRecover`, `erc20Recover`, `erc721Recover`) if strategy flags and manager checks allow.

**Assign To**
- Set by `ManagedNFTManager.setAuthorizedUser(managedTokenId, account)`.

**Emergency actions**
- If compromised:
  ```solidity
  // called by MANAGED_NFT_ADMIN on ManagedNFTManager
  ManagedNFTManagerUpgradeable.setAuthorizedUser(managedTokenId, safeUser);
  ```
- Optionally disable managed NFT or tighten flags until safe.

---

### ManagedNFTManager + flags

Not a direct role, but the manager and `getStrategyFlags` govern the behaviour surface.

**Capabilities**
- Strategy checks flags via `_hasFlag` and `_requirePermisisonIfNotSetupFlag`.
- Flags can allow:
  - Ignoring restrictions on public veNFT compound,
  - Ignoring restrictions on ERC20 compound,

**Assign To**
- Flags are set by `ManagedNFTManager.setStrategyFlags(strategy, flags)`.

**Emergency actions**
- If flags are set too permissively:
  - Reset them via manager:
    ```solidity
    ManagedNFTManagerUpgradeable.setStrategyFlags(strategy, safeFlags);
    ```

---

## RouterV2PathProviderUpgradeable

Manages curated routes for Router V2, including allowed input tokens and per-token route definitions.  
This contract does **not** hold funds.

### Owner (Ownable2StepUpgradeable)

Sole admin controlling routes, factory, and router addresses.

**Capabilities**
- Initialize `factory` and `router`:
  - `initialize(factory, router)` (once).
- Manage allowed input tokens:
  - `setAllowedTokenInInputRouters(token, bool isAllowed)`.
- Manage token routes:
  - Add route: `addRouteToToken(token, route)`.
  - Remove route: `removeRouteFromToken(token, route)`.

**Assign To**
- Governance / routing config multisig.
- EOAs acceptable, but misconfiguration can harm routing UX and potentially MEV surfaces.

**Emergency actions**
- If this key is compromised:
  - Treat all routing hints from this contract as untrusted.
  - From new safe owner (after transferring ownership via proxy/admin):
    ```solidity
    RouterV2PathProviderUpgradeable.setAllowedTokenInInputRouters(badToken, false);
    // optionally clear or replace routes for affected tokens
    RouterV2PathProviderUpgradeable.removeRouteFromToken(token, compromisedRoute);
    ```
  - Off-chain, route aggregators and frontends should ignore this provider until it’s reset to safe configuration or replaced.



## AlgebraFactoryUpgradeable

Factory used to deploy Algebra V3 pools and configure their default parameters.

---

### DEFAULT_ADMIN_ROLE

Top-level admin for the factory and its AccessControl roles.

**Capabilities**
- Grant/revoke:
  - `POOLS_ADMINISTRATOR_ROLE`
  - `POOLS_CREATOR_ROLE`
  - Any future roles.
- Indirectly controls who can pause pool creation and adjust defaults (via ownership and roles).

**Assign To**
- Governance / timelock / multisig.
- EOAs not recommended.

**Emergency actions**
- If this key is compromised:
  ```solidity
  // From governance / proxy admin
  AlgebraFactoryUpgradeable.transferOwnership(safeOwner);
  // From safeOwner:
  AlgebraFactoryUpgradeable.acceptOwnership();
  AlgebraFactoryUpgradeable.revokeRole(POOLS_ADMINISTRATOR_ROLE, compromisedAdmin);
  AlgebraFactoryUpgradeable.revokeRole(POOLS_CREATOR_ROLE, compromisedCreator);
  AlgebraFactoryUpgradeable.grantRole(DEFAULT_ADMIN_ROLE, safeAdmin);
  ```
- Review and correct:
  - `defaultCommunityFee`, `defaultFee`, `defaultTickspacing`,
  - `defaultPluginFactory`, `vaultFactory`.

---

### POOLS_ADMINISTRATOR_ROLE

Operational role managing pool-wide features and factory-level toggles.

**Capabilities**
- Set pause and creation modes (typically via higher-level logic using this role).
- Set `communityVaultFactory`.

**Assign To**
- Protocol operator wallet & governance multisig.

**Emergency actions**
- If compromised:
  ```solidity
  // via DEFAULT_ADMIN_ROLE
  AlgebraFactoryUpgradeable.revokeRole(POOLS_ADMINISTRATOR_ROLE, compromisedAdmin);
  AlgebraFactoryUpgradeable.grantRole(POOLS_ADMINISTRATOR_ROLE, safeAdmin);
  ```
- Validate:
  - `isPublicPoolCreationMode`,
  - `communityVaultFactory`,
  and other parameters managed by this role.

---

### POOLS_CREATOR_ROLE

Role permitting creation of new pools when `isPublicPoolCreationMode == false`.

**Capabilities**
- Create pools:
  - `createPool(tokenA, tokenB, stable)` (via the AlgebraFactory).

**Assign To**
- Limited set of trusted pool-creation actors (router, deployment multisig).
- EOAs only if strictly necessary and monitored.

**Emergency actions**
- If compromised:
  ```solidity
  AlgebraFactoryUpgradeable.revokeRole(POOLS_CREATOR_ROLE, compromisedCreator);
  ```
- Treat pools created during the compromise as suspect until audited and explicitly whitelisted by governance.

---

### Owner (Ownable2StepUpgradeable)

Factory owner; also synchronized with DEFAULT_ADMIN_ROLE via `_transferOwnership`.

**Capabilities**
- Toggle public pool creation:
  - `setIsPublicPoolCreationMode(bool)`.
- Configure defaults:
  - `setDefaultCommunityFee(uint16)`
  - `setDefaultFee(uint16)`
  - `setDefaultTickspacing(int24)`
  - `setDefaultPluginFactory(address)`
  - `setVaultFactory(address)`
- Control ownership renounce lifecycle:
  - `startRenounceOwnership()`
  - `stopRenounceOwnership()`
  - `renounceOwnership()` (after delay).

**Assign To**
- Governance / timelock / multisig.
- Same entity that controls protocol upgrades.

**Emergency actions**
- If owner key is compromised:
  - Transfer ownership to a safe multisig via external governance.
  - Re-grant DEFAULT_ADMIN_ROLE to the new owner; revoke from compromised owner.
  - Check that:
    - No malicious poolDeployer, plugin factory, or vault factory was set.
    - Defaults and creation modes remain safe.

---

## AlgebraPool

Concentrated-liquidity pool contract for swaps, liquidity and fee accrual.  
Has no internal AccessControl; uses the factory and plugin for privileged operations.

### Pool Administrator (via AlgebraFactory.POOLS_ADMINISTRATOR_ROLE)

Admin is determined via `IAlgebraFactory(factory).hasRoleOrOwner(POOLS_ADMINISTRATOR_ROLE, msg.sender)`.

**Capabilities**
- Change pool parameters:
  - `setCommunityFee(uint16)`
  - `setTickSpacing(int24)`
  - `setPlugin(address)`
  - `setPluginConfig(uint8)` (if caller is admin, not plugin).
  - `setCommunityVault(address)`.

**Assign To**
- Same governance / ops multisig that holds `POOLS_ADMINISTRATOR_ROLE` on factory.

**Emergency actions**
- If the admin role at factory level is compromised:
  - See `AlgebraFactoryUpgradeable` emergency section.
  - For critical pools, from a safe admin:
    ```solidity
    AlgebraPool.setCommunityFee(0);              // if community vault is unsafe
    AlgebraPool.setPlugin(safePlugin));           // or set to safe plugin
    AlgebraPool.setCommunityVault(safeVault);    // restore correct vault
    ```

---

### Plugin (IAlgebraPlugin, e.g. AlgebraBasePluginV1)

External contract plugged into the pool to handle dynamic fees and hooks.

**Capabilities**
- If connected (via `plugin` address), receives hooks:
  - `beforeInitialize`, `afterInitialize`
  - `beforeSwap`, `afterSwap`
  - `beforeFlash`, `afterFlash`
  - `beforeModifyPosition`, `afterModifyPosition`
- If `DYNAMIC_FEE` flag is enabled in `pluginConfig`, plugin may call:
  - `setFee(uint16)`.

**Assign To**
- Typically the default plugin (`AlgebraBasePluginV1` from `BasePluginV1Factory`).
- Custom plugins only if fully audited and governed.

**Emergency actions**
- If plugin is compromised:
  - From pool admin:
    ```solidity
    AlgebraPool.setPlugin(address(safePlugin)); // move to safe plugin
    ```
  - Optionally deploy a new safe plugin and set it via `setPlugin(newPlugin)`.
  - Consider pausing dependent routers until new plugin is live and verified.

---

## AlgebraBasePluginV1

Default Algebra plugin providing volatility oracle, TWAP, adaptive fee logic and integration with farming incentives.

### ALGEBRA_BASE_PLUGIN_MANAGER (via AlgebraFactory.hasRoleOrOwner)

Admin for dynamic fee configuration in this plugin.

**Capabilities**
- Configure fee shape via:
  - `changeFeeConfiguration(AlgebraFeeConfiguration config)`.

**Assign To**
- Risk / governance multisig responsible for fee policy (slippage, competitiveness, protocol revenue).

**Emergency actions**
- If compromised:
  ```solidity
  // via AlgebraFactory DEFAULT_ADMIN_ROLE
  AlgebraFactoryUpgradeable.revokeRole(ALGEBRA_BASE_PLUGIN_MANAGER, compromisedManager);
  AlgebraFactoryUpgradeable.grantRole(ALGEBRA_BASE_PLUGIN_MANAGER, safeManager);
  ```
- Immediately call `changeFeeConfiguration` with a conservative, safe fee config to prevent abusive fee spikes.
