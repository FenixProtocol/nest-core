# GaugeRewarder Claim Signature Generation Guide

To enable users to claim their rewards from the `GaugeRewarder` contract, a backend service is responsible for generating a signature that authenticates the claim. This guide will walk through the fields required for signature generation, how to properly construct the signature, and an example JavaScript implementation.

## Fields Required for Signature Generation
The signature allows a user to claim their reward, and it must be generated with specific fields using the EIP-712 standard. A claim without a backend tracking identifier includes the following fields:

1. **user**: The address of the user who will be claiming the reward.
   - Type: `address`
   - Represents the wallet address of the user eligible for the reward.

2. **totalAmount**: The total amount of reward tokens the user is entitled to claim. **This is cumulative per user across all claim overloads.**
   - Type: `uint256`
   - This value represents the cumulative reward amount that the user can claim.

3. **deadline**: The expiration time of the claim.
   - Type: `uint256`
   - Specifies an exclusive Unix expiration timestamp. The claim must execute with `block.timestamp < deadline`; equality is expired.

A claim overload with backend tracking uses the `PositionClaim` EIP-712 type and adds:

4. **identifier**: Opaque backend tracking metadata included in the signature and emitted event.
   - Type: `bytes32`
   - This value does not create separate accounting; all identifiers share `claimed[user]`.

## Steps to Generate the Signature
The signature must be generated using the following components:

- **Domain Separator**: This defines the context of the signature. It includes the contract's name, version, chain ID, and the verifying contract's address.
  - **name**: "GaugeRewarder"
  - **version**: "1"
  - **chainId**: The chain ID of the network where the contract is deployed.
  - **verifyingContract**: The address of the `GaugeRewarder` contract.

- **Types Definition**: This defines the structure of the data to be signed. Use `Claim` for an overload without an identifier and `PositionClaim` when an identifier is included.

- **Value Object**: This contains the actual data that needs to be signed, such as the user's address, the total reward amount, and the deadline.

- **`totalAmount` represents the user's entitlement across all periods, gauges, and claim overloads. It must never be reset. The identifier is used only for backend tracking.**

## JavaScript Example for Signature Generation
Below is an example implementation in JavaScript, using Hardhat and Ethers.js. This example can be adapted to other frameworks as needed.

```js
async function createSignature(signer, user, totalAmount, deadline) {
  // Define the EIP-712 domain for the signature
  const domain = {
    name: 'GaugeRewarder',
    version: '1',
    chainId: (await ethers.provider.getNetwork()).chainId, // Fetch the current network chain ID
    verifyingContract: await instance.getAddress(), // The address of the GaugeRewarder contract
  };

  // Define the types for the data structure to be signed
  const types = {
    Claim: [
      { name: 'user', type: 'address' },
      { name: 'totalAmount', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
    ],
  };

  // Define the value object with the fields required for the claim
  const value = {
    user: user, // The user's wallet address
    totalAmount: totalAmount, // The total amount of rewards being claimed
    deadline: deadline, // The Unix timestamp by which the claim must be made
  };

  // Generate and return the signature using the signer
  return await signer.signTypedData(domain, types, value);
}
```

### Detailed Explanation
1. **Domain**: The domain object is used to uniquely identify the context of the data being signed. This ensures that the signature is valid only for the specified contract (`GaugeRewarder`) on the correct blockchain network.

2. **Types**: The types object defines the structure of the data. In this case, the `Claim` type consists of `user`, `totalAmount`, and `deadline` fields.

3. **Value**: The value object contains the actual data that needs to be signed. This includes the address of the user making the claim, the total amount of tokens they are entitled to, and the deadline for the claim.

### Notes for Backend Implementation
- Ensure that the `chainId` is correctly retrieved from the current network where the contract is deployed.
- The `verifyingContract` must be the correct address of the `GaugeRewarder` contract.
- For a claim overload with an identifier, sign `PositionClaim(address user,uint256 totalAmount,uint256 deadline,bytes32 identifier)`. This is the EIP-712 primary type expected by that overload.
- Read or track the single `claimed[user]` counter used by every claim overload. A `totalAmount` less than or equal to that counter reverts with `AlreadyClaimed`, regardless of the identifier.
- Claims are valid only while the execution timestamp is strictly less than `deadline`.
- Use a secure signing mechanism to prevent unauthorized access to the signer credentials.

### Summary
The `createSignature` function allows the backend to generate a signature for the user that authenticates the reward claim process. The generated signature should be sent to the user, who can then use it to claim their rewards by calling the `claim` or `claimFor` methods in the `GaugeRewarder` contract. This ensures a secure, verifiable, and seamless reward distribution process.
