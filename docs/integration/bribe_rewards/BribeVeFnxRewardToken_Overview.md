# BribeVeNESTRewardToken Overview

## Purpose

The `BribeVeNESTRewardToken` contract serves as an intermediary mechanism for converting NEST-based rewards into governance-weighted veNFT positions through the `VotingEscrow` contract. This intermediary token, called `brVeNEST`, simplifies the integration of bribe mechanisms by managing the complex conversion of NEST into veNFT NFTs.

### Key Features:
1. **NEST Conversion:** Users can deposit NEST and receive `brVeNEST` tokens.
2. **Automatic veNFT Lock Creation:** Transfers of `brVeNEST` to non-whitelisted addresses automatically trigger a conversion into veNFT NFTs.
3. **Role-Based Control:** Administrators manage configurations, while minters and whitelisted addresses have specific privileges.

## Core Functionalities

### Minting `brVeNEST`
The `mint` function allows entities with the `MINTER_ROLE` to mint `brVeNEST` tokens in exchange for NEST deposits.

- **Use Case:** Entities or contracts can introduce NEST rewards into the system by minting `brVeNEST`.
- **Access Control:** Only addresses with `MINTER_ROLE` can call this function.

### Automatic Conversion to veNFT
When `brVeNEST` tokens are transferred to a non-whitelisted address, they are:
1. Burned by the `BribeVeNESTRewardToken` contract.
2. Converted into veNFT NFTs via the `VotingEscrow` contract.

This ensures that the end-users receive governance-weighted veNFT positions.

### Configuration Management
Admins with the `DEFAULT_ADMIN_ROLE` can update the parameters for veNFT lock creation, including:
- Lock duration.
- Boosting options.
- Permanent lock settings.
- Managed token attachments.

## Methods and Events

### Methods

#### `mint(address to_, uint256 amount_)`
**Description:** Mints `brVeNEST` tokens for a specified address in exchange for NEST deposits.

**Parameters:**
- `to_`: Address receiving the minted `brVeNEST` tokens.
- `amount_`: Amount of NEST deposited and `brVeNEST` tokens minted.

**Requirements:**
- Caller must have the `MINTER_ROLE`.
- NEST tokens must be approved for transfer to the contract.

---

#### `updateCreateLockParams(CreateLockParams memory createLockParams_)`
**Description:** Updates the parameters used for creating veNFT locks upon automatic conversion.

**Parameters:**
- `createLockParams_`: Struct containing:
  - `lockDuration`: Duration for NEST locks (in seconds).
  - `shouldBoosted`: Whether the veNFT position should be boosted.
  - `withPermanentLock`: If true, the lock is permanent.
  - `managedTokenIdForAttach`: Attach created veNFT to a managed token ID if non-zero.

**Requirements:**
- Caller must have the `DEFAULT_ADMIN_ROLE`.

**Emitted Events:**
- `UpdateCreateLockParams` with the new parameters.

---

#### `createLockParams()`
**Description:** Retrieves the current parameters for veNFT lock creation.

**Returns:**
- `lockDuration`: Lock duration in seconds.
- `shouldBoosted`: Whether the lock is boosted.
- `withPermanentLock`: Permanent lock status.
- `managedTokenIdForAttach`: Managed token ID for attachment.

---

### Events

#### `UpdateCreateLockParams(CreateLockParams createLockParams)`
**Emitted When:**
- The lock parameters are updated by an admin.

**Parameters:**
- `createLockParams`: Struct with updated lock configuration.

---

## Roles and Access Control

### `MINTER_ROLE`
- **Purpose:** Allows entities to mint `brVeNEST` tokens.
- **Assigned To:** Trusted entities or contracts managing reward flows.

### `WHITELIST_ROLE`
- **Purpose:** Prevents automatic veNFT conversion for certain recipients.
- **Assigned To:** Addresses exempt from the burn-and-lock mechanism.

### `DEFAULT_ADMIN_ROLE`
- **Purpose:** Allows full control over contract configurations, including:
  - Updating lock parameters.
  - Managing roles.
- **Assigned To:** Governance or administrative entities.

## How It Works

### Workflow
1. **Minting Rewards:**
   - A `MINTER_ROLE` entity deposits NEST and mints `brVeNEST` tokens for distribution.
2. **Reward Distribution:**
   - `brVeNEST` tokens are sent to users or bribe contracts.
3. **Automatic Conversion:**
   - When a non-whitelisted address receives `brVeNEST`:
     - Tokens are burned.
     - NEST is locked in the `VotingEscrow` contract.
     - The recipient receives a veNFT NFT.

### Example
1. Admin configures lock parameters:
   ```solidity
   createLockParams({
       lockDuration: 15724800, // 6 months
       shouldBoosted: true,
       withPermanentLock: false,
       managedTokenIdForAttach: 0
   });
   ```
2. A minter mints 1,000 `brVeNEST` tokens for a bribe contract.
3. A user claims rewards and receives a veNFT NFT corresponding to the burned `brVeNEST`.