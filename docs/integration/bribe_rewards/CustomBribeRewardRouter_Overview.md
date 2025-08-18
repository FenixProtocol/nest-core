
# CustomBribeRewardRouter -  Overview

## Introduction

`CustomBribeRewardRouter` serves as a bridge that facilitates the distribution of NEST-based rewards to external "bribe" contracts associated with various pools. Since external bribe contracts do not natively handle veNEST tokens (veNEST are represented as NFTs derived from locked NEST), the router uses an intermediary token (`brVeNEST`) to integrate veNEST-like rewards seamlessly. Ultimately, users who claim rewards from these bribe contracts receive veNEST NFTs

## Key Concepts

1. **NEST to veNEST as Rewards via `notifyRewardNESTInVeNEST`**  
   Users can provide NEST tokens to the router, which converts them into `brVeNEST` and notifies the appropriate external bribe contract for a specified pool that new rewards are available. This allows the introduction of NEST-derived rewards without directly handling veNEST NFTs at this initial stage.

2. **veNEST as Rewards via `notifyRewardVeNESTInVeNest`**  
   Users can also provide a veNEST NFT to the router. The router burns the NFT, reclaims the underlying NEST, converts that NEST into `brVeNEST`, and then notifies the appropriate external bribe contract. This process effectively transforms locked veNEST positions into rewards that can be distributed through bribe contracts.

**Any user** can perform these actions when the corresponding methods are enabled.

## Associated Contracts and Roles

- **Voter Contract (`voter`)**

- **BribeVeNESTRewardToken (brVeNEST)**:  
  An intermediary ERC20 token that represents converted NEST.  
  When NEST is introduced as a reward, it is converted to `brVeNEST`.  
  When `brVeNEST` is ultimately claimed by users from the bribe contracts, it triggers a conversion into veNEST NFTs via `VotingEscrow`, and the `brVeNEST` tokens are burned.
  
  **Workflow with `brVeNEST`:**
  1. NEST → brVeNEST (introduction of rewards).
  2. brVeNEST sent to bribe contracts.
  3. On user claims: brVeNEST → veNEST NFT (via `VotingEscrow`) and brVeNEST is burned.

- **VotingEscrow**

### Roles

- **DEFAULT_ADMIN_ROLE**:
  - Can call `setupFuncEnable` to enable or disable contract methods.
  - Can update `createLockParams` on `BribeVeNESTRewardToken`.
  
- **MINTER_ROLE** (on the `BribeVeNESTRewardToken` contract):
  - Entities with this role can mint `brVeNEST` tokens by depositing NEST.
  
- **WHITELIST_ROLE** (on the `BribeVeNESTRewardToken` contract):
  - Addresses with this role are exempt from automatic conversion of `brVeNEST` into veNEST NFTs when they receive `brVeNEST`.

## Contract Initialization and Configuration

- **initialize(address blastGovernor_, address voter_, address bribeVeNestRewardToken_)**  
  Initializes the `CustomBribeRewardRouter`:
  - Sets `blastGovernor` for governor-controlled logic.
  - Sets `voter` to map pools to external bribes.
  - Sets `bribeVeNestRewardToken` as the intermediary token contract.

- **setupFuncEnable(bytes4 funcSign_, bool isEnable_)**  
  Allows admins (`DEFAULT_ADMIN_ROLE`) to enable or disable specific functions by their 4-byte selector.  
  For example:  
  `setupFuncEnable(ICustomBribeRewardRouter.notifyRewardNESTInVeNEST.selector, true);`

## Main Methods

### `notifyRewardNESTInVeNEST(address pool_, uint256 amount_)`

**Description:**  
Converts regular NEST tokens into `brVeNEST` and allocates them as rewards to the bribe contract associated with `pool_`.

**Parameters:**
- `pool_`: Address of the pool for which rewards are allocated.
- `amount_`: Amount of NEST to be converted into `brVeNEST`.

**Workflow:**
1. The caller approves this contract to spend `amount_` NEST.
2. `notifyRewardNESTInVeNEST` transfers NEST from the caller, converts it into `brVeNEST`.
3. The router queries `voter` to find the external bribe contract linked to `pool_`.
4. It then approves and notifies that external bribe contract of the new `brVeNEST` reward.

**Requirements:**
- The function must be enabled via `setupFuncEnable`.
- Valid external bribe contract mapping must exist for `pool_`.
- The caller must have sufficient NEST approved for the transfer.

**Emitted Event:**  
`NotifyRewardNESTInVeNest(caller, pool_, externalBribe, amount_)`

### `notifyRewardVeNESTInVeNest(address pool_, uint256 tokenId_)`

**Description:**  
Converts a veNEST NFT into `brVeNEST` rewards for a given pool.

**Parameters:**
- `pool_`: Address of the pool for which rewards are allocated.
- `tokenId_`: The ID of the veNEST NFT to be converted into rewards.

**Workflow:**
1. The caller transfers the veNEST NFT to this contract.
2. If the NFT was permanently locked, it may be unlocked first.
3. `votingEscrow.burnToBribes(tokenId_)` is called to convert the NFT back to NEST.
4. Convert NEST into `brVeNEST`.
5. Determine the external bribe contract via `voter` and notify it.

**Requirements:**
- The function must be enabled.
- A valid external bribe contract must exist for `pool_`.
- The veNEST NFT must be in a state that allows burning.

**Emitted Event:**  
`NotifyRewardVeNESTInVeNest(caller, pool_, externalBribe, tokenId_, amount)`

## Events

- **FuncEnabled(bytes4 funcSign, bool isEnable)**  
  Emitted when enabling or disabling a function’s availability.

- **NotifyRewardNESTInVeNest(address indexed caller, address indexed pool, address indexed externalBribe, uint256 amount)**  
  Emitted when NEST is converted into `brVeNEST` and notified to an external bribe contract.

- **NotifyRewardVeNESTInVeNest(address indexed caller, address indexed pool, address externalBribe, uint256 indexed tokenId, uint256 amount)**  
  Emitted when a veNEST NFT is burned, converted into `brVeNEST`, and notified to an external bribe contract.

## Errors

- **FunctionDisabled()**:  
  Thrown if a disabled function is called.

- **InvalidPool(address pool)**:  
  Thrown if the given `pool` does not map to a valid gauge or active external bribe contract.

- **InvalidBribe(address bribe)**:  
  Thrown if the external bribe address obtained is invalid (e.g., zero address).

## How to Use

1. **Initial Setup**:
   - An admin with `DEFAULT_ADMIN_ROLE` can enable/disable methods using `setupFuncEnable`.
   
2. **Distributing NEST-Based Rewards**:
   - Ensure `notifyRewardNESTInVeNEST` is enabled if not.
   - Approve the router to spend `amount` NEST.
   - Call `notifyRewardNESTInVeNEST(pool, amount)`.

3. **Distributing veNEST-Based Rewards**:
   - Ensure `notifyRewardVeNESTInVeNest` is enabled if not.
   - Transfer your veNEST NFT to the router contract.
   - Call `notifyRewardVeNESTInVeNest(pool, tokenId)`.

4. **Claiming Rewards from Bribe Contracts (User Perspective)**:
   - Users claim rewards from the bribe contract.
   - They receive veNEST NFTs, as `brVeNEST` is converted and burned in the process.
