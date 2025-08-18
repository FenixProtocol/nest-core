# Voter Aggregate Claim Documentation

## Overview

The `aggregateClaim` function in the `VoterUpgradeable` contract allows users to combine multiple claim operations into a single transaction. This feature is particularly useful for reducing gas costs and streamlining the claiming process for various rewards and bribes. The function supports claiming rewards from gauges, bribes, Merkl data, and optionally locks a percentage of the claimed reward tokens into a veNFT.

## Function signature
```solidity
    /**
     * @notice Aggregates multiple claim calls into a single transaction.
     * @param gauges_ The array of gauge addresses to claim rewards from.
     * @param bribes_ The parameters for claiming bribes without token ID.
     * @param bribesByTokenId_ The parameters for claiming bribes with a token ID.
     * @param blaze_ The parameters for claiming rewards using Blaze Gauge Rewarder.
     * @param splitMerklAidrop_ The parameters for claiming VeNest Merkl airdrop data.
     * @param aggregateCreateLock_ The parameters for locking a percentage of the claimed rewards into a veNFT.
     */
    function aggregateClaim(
        address[] calldata gauges_,
        AggregateClaimBribesParams calldata bribes_,
        AggregateClaimBribesByTokenIdParams calldata bribesByTokenId_,
        AggregateClaimBlazeDataParams calldata blaze_,
        AggregateClaimVeNestMerklAirdrop calldata splitMerklAidrop_,
        AggregateCreateLockParams calldata aggregateCreateLock_
    ) external;
```

### Input Types
```solidity
       /**
     * @dev Parameters for claiming bribes using a specific tokenId.
     */
    struct AggregateClaimBribesByTokenIdParams {
        uint256 tokenId; ///< The token ID to claim bribes for.
        address[] bribes; ///< The array of bribe contract addresses.
        address[][] tokens; ///< The array of arrays containing token addresses for each bribe.
    }

    /**
     * @dev Parameters for claiming bribes.
     */
    struct AggregateClaimBribesParams {
        address[] bribes; ///< The array of bribe contract addresses.
        address[][] tokens; ///< The array of arrays containing token addresses for each bribe.
    }

    /**
     * @notice Parameters for claiming Blaze data.
     * @param totalAmount The total amount of reward being claimed.
     * @param deadline The expiration time of the claim.
     * @param signature The signature authorizing the claim.
     */
    struct AggregateClaimBlazeDataParams {
        uint256 totalAmount;
        uint256 deadline;
        bytes signature;
    }

    /**
    * @dev Parameters for claiming VeNest Merkl airdrop data.
    */
    struct AggregateClaimVeNestMerklAirdrop {
        bool inPureTokens; ///< Indicates if the claim is in pure tokens.
        uint256 amount; ///< The amount to claim.
        bool withPermanentLock; ///< Indicates if the lock should be permanent for veNFT claims.
        uint256 managedTokenIdForAttach; ///< ID of the managed NFT to attach (0 to ignore).
        bytes32[] proofs; ///< The array of Merkle proofs.
    }

    /**
     * @notice Parameters for creating a veNFT through.
     * @param percentageToLock The percentage (in 18 decimals) of the claimed reward tokens to be locked.
     * @param lockDuration The duration (in seconds) for which the tokens will be locked.
     * @param to The address that will receive the veNFT.
     * @param shouldBoosted Indicates whether the veNFT should have boosted properties.
     * @param withPermanentLock Indicates if the lock should be permanent.
     * @param managedTokenIdForAttach The ID of the managed veNFT token to which this lock will be attached.
     */
    struct AggregateCreateLockParams {
        uint256 percentageToLock;
        uint256 lockDuration;
        address to;
        bool shouldBoosted;
        bool withPermanentLock;
        uint256 managedTokenIdForAttach;
    }
```

## Usage

To use the `aggregateClaim` function, users need to call it with the appropriate parameters. Here are some examples:

### Example 1: Converting 100% NEST to veNFT Lock
```solidity
VoterUpgradeable.aggregateClaim(
   ...,
    AggregateCreateLockParams({
        percentageToLock: 1e18, // 100%
        lockDuration: 182 * 86400,
        to: 0xuserAddress1,
        shouldBoosted: false,
        withPermanentLock: false,
        managedTokenIdForAttach: 0
    })
);
```
### Example 2:
```solidity
VoterUpgradeableV1_2.aggregateClaim(
    gauges_,
    AggregateClaimBribesParams({
        bribes: [bribeAddress1, bribeAddress2],
        tokens: [[tokenA, tokenB], [tokenC]]
    }),
    AggregateClaimBribesByTokenIdParams({
        tokenId: 12345,
        bribes: [bribeAddress3],
        tokens: [[tokenD]]
    }),
    AggregateClaimBlazeDataParams({
        totalAmount: amount1,
        deadline: block.timestamp + 3600,
        signature: claimSignature,
    }),
    AggregateClaimVeNestMerklAirdrop({
        amount: amount3,
        proofs: [proof3]
    }),
    AggregateCreateLockParams({
        percentageToLock: 0, // 0%
        lockDuration: 0,
        to: 0xuserAddress1,
        shouldBoosted: false,
        withPermanentLock: false,
        managedTokenIdForAttach: 0
    })
);
```

## Function Mechanics

1. **Claim Rewards from Gauges**: The function first claims rewards from the specified gauges using the `claimRewards` method.
2. **Claim Bribes without Token ID**: It then claims bribes from the specified bribe contracts without using a token ID via the `claimBribes` method.
3. **Claim Bribes with Token ID**: Next, it claims bribes using the specified token ID by calling `claimBribes` with the token ID.
4. **Claim Blaze Data**: Finally, it claims rewards based on Gauge Rewarder signatures by calling the `claimFor` method on the `GaugeRewarder` contract.
5. **Claim VeNest Merkl Airdrop**: Claims the VeNest Merkl airdrop by calling the `claimFor` method on the `VeNestSplitMerklAidrop` contract.
6. **Lock Claimed Rewards**: If `percentageToLock` is greater than 0, a percentage of the claimed rewards will be locked into a veNFT through the `VotingEscrow` contract.

This comprehensive aggregation allows users to perform multiple reward and bribe claims efficiently within a single transaction, reducing the overall gas cost and simplifying the claiming process.

## Features
- The claim call is made only for the caller. Specifying tokenId or other user addresses in the parameters will only result in a transaction failure.
- If the length of the arrays is 0, then the call to request a reward for this parameter and type will be skipped, this will not lead to a transaction failure.

## Parameters

### `gauges_`

- **Type**: `address[]`
- **Description**: An array of gauge addresses from which rewards will be claimed.
- **Equivalent Call**: `claimRewards(gauges_)`
- **Details**: This parameter specifies the gauges from which the user wants to claim rewards. The function iterates over the array and calls `claimRewards` for each gauge.

### `bribes_`

- **Type**: `AggregateClaimBribesParams`
  - `address[] bribes`: An array of bribe contract addresses.
  - `address[][] tokens`: A nested array where each sub-array contains token addresses associated with each bribe contract.
- **Equivalent Call**: `claimBribes(bribes, tokens)`
- **Details**: This parameter allows the user to claim bribes from multiple bribe contracts. Each bribe contract is associated with multiple tokens, specified in the nested array.

### `bribesByTokenId_`

- **Type**: `AggregateClaimBribesByTokenIdParams`
  - `uint256 tokenId`: The token ID used to claim bribes.
  - `address[] bribes`: An array of bribe contract addresses.
  - `address[][] tokens`: A nested array where each sub-array contains token addresses associated with each bribe contract.
- **Equivalent Call**: `claimBribes(bribes, tokens, tokenId)`
- **Details**: Similar to `bribes_`, but this parameter includes a `tokenId` to specify claims based on a specific token ID. This is useful for scenarios where bribes are tied to particular NFTs or other token-based identifiers.
- **Requirements**: The caller must be the owner or approved address for a provided tokenId.

### `blaze_`

- **Type**: `AggregateClaimBlazeDataParams`
  - `uint256 totalAmount`: The total amount of reward being claimed..
  - `uint256 deadline`: The expiration time of the claim.
  - `bytes signature`: The signature authorizing the claim.
- **Equivalent Call**: `IGaugeRewarder(gaugeRewarder).claim(totalAmount, signature, deadline)`
- **Details**: This parameter allows for claiming rewards based on Gauge Rewarder claim signature. 

### `splitMerklAidrop_`
- **Type**: `AggregateClaimVeNestMerklAirdrop`
    - `uint256 amount`: The amount to claim.
    - `bool withPermanentLock`: Specifies if the veNFT lock should be permanent (applicable only when claiming as veNFT).
    - `uint256 managedTokenIdForAttach`: ID of the managed NFT to attach if required (0 if not attaching to any NFT).
    - `bytes32[] proofs`: The array of Merkle proofs.
- **Equivalent Call**: `IVeNestSplitMerklAidrop(veNesatMerklAidrop).claim(inPureTokens, amount, withPermanentLock, managedTokenIdForAttach, proofs)`
- **Details**: This parameter is used to claim the VeNest Merkl airdrop.

### `aggregateCreateLock_`
- **Type**: `AggregateCreateLockParams`
    - `uint256 percentageToLock`: The percentage (in 18 decimals) of the claimed reward tokens to be locked.
    - `uint256 lockDuration`: The duration (in seconds) for which the tokens will be locked.
    - `address to`: The address that will receive the veNFT.
    - `bool shouldBoosted`: Indicates whether the veNFT should have boosted properties.
    - `bool withPermanentLock`: Indicates if the lock should be permanent.
    - `uint256 managedTokenIdForAttach`: The ID of the managed veNFT token to which this lock will be attached.
- **Equivalent Call**: `votingEscrow.createLockFor(amount, lockDuration, to, shouldBoosted, withPermanentLock, managedTokenIdForAttach)`
- **Details**: This parameter allows users to specify if they want to convert a percentage of the claimed NEST rewards into a veNFT lock. The value for `percentageToLock` must be between 0 and 1e18 (representing 0% to 100%).
- **Requirements**: Before using this functionality, users must approve the Voter contract to spend the NEST that will be locked. This is necessary because the contract will transfer the tokens from the user's balance during the claim transaction.