import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { mine, time } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { ERC20Mock, ManagedNFTManagerMock, VeArtProxy, VoterMock, VotingEscrowUpgradeableV2 } from '../../../typechain-types';
import { deployArtProxy, deployERC20MockToken } from '../../utils/coreFixture';

import { ContractTransactionResponse } from 'ethers';
import { ERRORS, ONE_ETHER, VotingEscrowDepositType } from '../../utils/constants';

const MAX_LOCK_TIME = 15724800;
const WEEK = 86400 * 7;

type Signers = {
  deployer: HardhatEthersSigner;
  proxyAdmin: HardhatEthersSigner;
  user1: HardhatEthersSigner;
  user2: HardhatEthersSigner;
  others: HardhatEthersSigner[];
};

async function roundToWeek(time: bigint) {
  return (time / BigInt(WEEK)) * BigInt(WEEK);
}

async function getRestForNextEpoch() {
  let nowTime = BigInt(await time.latest());

  let currentEpoch = (nowTime / BigInt(WEEK)) * BigInt(WEEK);
  return currentEpoch + BigInt(WEEK) - nowTime;
}

async function fixture() {
  let signers = await ethers.getSigners();
  let VotingEscrow_Implementation = await ethers.deployContract('VotingEscrowUpgradeableV2', []);

  let VotingEscrow = (await ethers.deployContract('TransparentUpgradeableProxy', [
    VotingEscrow_Implementation.target,
    signers[2].address,
    '0x',
  ])) as any;
  VotingEscrow = await ethers.getContractAt('VotingEscrowUpgradeableV2', VotingEscrow.target);
  let ManagedNFTManagerMock = await ethers.deployContract('ManagedNFTManagerMock');
  let Voter = await ethers.deployContract('VoterMock');
  return {
    signers: {
      deployer: signers[0],
      proxyAdmin: signers[2],
      user1: signers[3],
      user2: signers[4],
      others: signers.slice(5, 10),
    },
    VotingEscrow_Implementation: VotingEscrow_Implementation,
    VotingEscrow: VotingEscrow,
    ManagedNFTManagerMock: ManagedNFTManagerMock,
    Voter: Voter,
  };
}

describe('VotingEscrow_V2', function () {
  let VotingEscrow: VotingEscrowUpgradeableV2;
  let VotingEscrow_Implementation: VotingEscrowUpgradeableV2;
  let VeArtProxyUpgradeable: VeArtProxy;
  let signers: Signers;
  let token: ERC20Mock;
  let initializeTx: ContractTransactionResponse;
  let managedNFTManager: ManagedNFTManagerMock;
  let voter: HardhatEthersSigner;
  let veBoost: HardhatEthersSigner;
  let initialVoterContract: VoterMock;

  beforeEach(async () => {
    const deployed = await fixture();
    VotingEscrow = deployed.VotingEscrow;
    VotingEscrow_Implementation = deployed.VotingEscrow_Implementation;

    managedNFTManager = deployed.ManagedNFTManagerMock;
    signers = deployed.signers;
    voter = signers.others[0];
    veBoost = signers.others[1];
    initialVoterContract = deployed.Voter;
    token = await deployERC20MockToken(signers.deployer, 'MOK', 'MOK', 18);
    initializeTx = await VotingEscrow.initialize(token.target);
    VeArtProxyUpgradeable = await deployArtProxy(signers.deployer, VotingEscrow.target.toString(), managedNFTManager.target.toString());

    await VotingEscrow.updateAddress('voter', initialVoterContract.target);
    await VotingEscrow.updateAddress('veBoost', veBoost.address);
    await VotingEscrow.updateAddress('artProxy', VeArtProxyUpgradeable.target);
    await VotingEscrow.updateAddress('managedNFTManager', managedNFTManager.target);
  });

  describe('Merge locks', async () => {

    beforeEach(async () => {
      await token.mint(signers.user1.address, ethers.parseEther('2'));
      await token.connect(signers.user1).approve(VotingEscrow.target, ethers.parseEther('100'));
      await VotingEscrow.connect(signers.user1).createLockFor(ONE_ETHER, 20 * WEEK, signers.user1.address, false, false, 0);
      await VotingEscrow.connect(signers.user1).createLockFor(ONE_ETHER, 4 * WEEK, signers.user1.address, false, false, 0);
    });

    it('success merge locks 1 to 2 with highest unlock end', async () => {
      let state1Before = await VotingEscrow.nftStates(1);
      let state2Before = await VotingEscrow.nftStates(2);
      let lockEndHighest = state1Before.locked.end > state2Before.locked.end ? state1Before.locked.end : state2Before.locked.end

      console.log("state1Before", state1Before.locked.end/BigInt(WEEK))
      console.log("state2Before", state2Before.locked.end/BigInt(WEEK))
      console.log("lockEndHighest", lockEndHighest/BigInt(WEEK))

      await VotingEscrow.connect(signers.user1).merge(1, 2);

      let state1After = await VotingEscrow.nftStates(1);
      let state2After = await VotingEscrow.nftStates(2);
      console.log("state1After", state1After.locked.end/BigInt(WEEK))
      console.log("state2After", state2After.locked.end/BigInt(WEEK))

      expect(state1After.locked.end).to.be.eq(0);
      expect(state2After.locked.end).to.be.eq(lockEndHighest);
      expect(state2After.locked.end).to.be.eq(state1Before.locked.end);
    });

    it('success merge locks 2 to 1 with highest unlock end', async () => {
      let state1Before = await VotingEscrow.nftStates(1);
      let state2Before = await VotingEscrow.nftStates(2);
      let lockEndHighest = state1Before.locked.end > state2Before.locked.end ? state1Before.locked.end : state2Before.locked.end

      console.log("state1Before", state1Before.locked.end/BigInt(WEEK))
      console.log("state2Before", state2Before.locked.end/BigInt(WEEK))
      console.log("lockEndHighest", lockEndHighest/BigInt(WEEK))

      await VotingEscrow.connect(signers.user1).merge(2, 1);

      let state1After = await VotingEscrow.nftStates(1);
      let state2After = await VotingEscrow.nftStates(2);
      console.log("state1After", state1After.locked.end/BigInt(WEEK))
      console.log("state2After", state2After.locked.end/BigInt(WEEK))

      expect(state2After.locked.end).to.be.eq(0);
      expect(state1After.locked.end).to.be.eq(lockEndHighest);
      expect(state1After.locked.end).to.be.eq(state1Before.locked.end);
    });
  });
});
