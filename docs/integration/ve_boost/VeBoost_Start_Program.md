# VeBoost Start Program

This document outlines the process for the administration to start the VeBoost system. 

## General Information

VeBoost is a system that allows users to receive additional rewards in the form of a boost for their locked NEST tokens. To start the VeBoost program, the administration needs to ensure the system is properly funded and configured.

## Steps to Start the VeBoost Program

### Step 1: Prepare the Ecosystem Fund Deposit

1. **Confirm NEST Supply**: Ensure that 100,000 NEST tokens are available in the Ecosystem Fund.
2. **Set Up Wallet**: Use the designated administration wallet with the necessary permissions to perform the deposit.

### Step 2: Ensure that the contract is deployed and initialized
1. Make sure the contract is deployed and initialized.
2. Setted in VotingEscrow contract

### Step 3: Configrue VeBoost program parameters
1. **Set Min USD Amount**: Set the minimum amount of NEST required to join the VeBoost program in dollar equivalent.
Call `setMinUSDAmount` on VeBoost contract

2. **Set Boost Percentage**: Set the boost percentage to 20%.
Call `setNESTBoostPercentage` on VeBoost contract

### Step 3: Deposit NEST Tokens into the VeBoost Contract
**!!!Important: From the moment of transfer NEST, tokens will be available for users who create veNFT**

**Transfer NEST Tokens**: Transfer 100,000 NEST tokens from the Ecosystem Fund to the VeBoost contract.

### Step 4: Verify the Deposit

**Check Contract Balance**: Ensure that the VeBoost contract now holds the 100,000 NEST tokens.


### Step 5: Announce the Program
