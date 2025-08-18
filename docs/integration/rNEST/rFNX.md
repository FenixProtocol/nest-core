# rNEST User Guide

## Overview

The RFenix smart contract enables rNEST token holders to convert their tokens into NEST and veNFT tokens. This document provides a detailed guide on interacting with the contract's functions.

## Prerequisites

- You should have a wallet containing rNEST tokens.
- Familiarity with Ethereum transactions and gas fees is recommended.

## Conversion Logic

When you convert rNEST tokens, the process follows a specific distribution:
- **40%** of the rNEST amount is directly converted to NEST tokens and credited to your balance instantly upon conversion.
- **60%** of the rNEST amount is converted to veNFT tokens, which are locked for a period of **182 days**.


## Contract Functions

### Convert All rNEST Tokens

**Function:** `convertAll()`

**Description:** This function converts the entire balance of the caller's rNEST tokens into NEST and veNFT tokens, adhering to the contract's conversion rate.

**How to Use:**
1. Invoke the `convertAll()` function from your wallet.
2. Confirm the transaction in your wallet to proceed with the conversion.

### Convert Specific Amount of rNEST Tokens

**Function:** `convert(uint256 amount_)`

**Description:** Allows conversion of a specified amount of rNEST tokens into NEST and veNFT tokens based on the contract's conversion rate.

**Parameters:**
- `amount_`: The exact amount of rNEST tokens you wish to convert.

**How to Use:**
1. Determine the amount of rNEST you want to convert.
2. Execute the `convert(uint256 amount_)` function, passing the desired amount as a parameter.
3. Confirm the transaction in your wallet.

## Additional Notes

- Ensure sufficient Ethereum in your wallet to cover gas fees for transactions.
- Transactions may fail due to insufficient gas or unmet contract conditions.
- Familiarize yourself with the current conversion rates and lock durations before initiating a conversion.

### Abi
```json
[
    {
      "inputs": [],
      "name": "convertAll",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "amount_",
          "type": "uint256"
        }
      ],
      "name": "convert",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
]
```
## Example

Alice, an rNEST token holder, wants to convert her rNEST tokens into NEST and veNFT tokens.

### Initial State

- Alice's wallet balance: 1,000 rNEST
- Conversion rate: 40% to NEST and 60% to veNFT
- Lock duration for veNFT: 182 days

### Action: Converting All rNEST Tokens

Alice decides to convert all her 1,000 rNEST tokens.

1. Alice calls the `convertAll()` function from her wallet interface.
2. She confirms the transaction, paying the necessary gas fees.

### Result of Conversion

- **400 NEST tokens** are credited to Alice's wallet immediately (40% of 1,000 rNEST).
- **600 NEST blocked as veNFT for 182 days** and transferred to Alice wallet (60% of 1,000 rNEST).

### Final State

- Alice’s rNEST balance is now 0.
- Alice has an additional 400 NEST tokens available to use.
- Alice has veNFT NFT with a balance of 600 NEST
