import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import {
  CompoundVeNESTManagedNFTStrategyFactoryUpgradeable,
  CompoundVeNESTManagedNFTStrategyUpgradeable,
  Fenix,
  ManagedNFTManagerUpgradeable,
  RouterV2,
  RouterV2PathProviderUpgradeable,
  VoterUpgradeableV2,
  VotingEscrowUpgradeableV2,
} from '../../../typechain-types';
import { ERRORS, WEEK, ZERO, getAccessControlError } from '../../utils/constants';
import completeFixture, {
  CoreFixtureDeployed,
  SignersList,
  deployERC20MockToken,
  deployTransaperntUpgradeableProxy,
} from '../../utils/coreFixture';
import { pool } from '@cryptoalgebra/integral-core/typechain/contracts/interfaces';

describe.skip('Voting pause functionality', function () {
  let deployed: CoreFixtureDeployed;
  let signers: SignersList;
  let Voter: VoterUpgradeableV2;
  let VotingEscrow: VotingEscrowUpgradeableV2;
  let ManagedNFTManager: ManagedNFTManagerUpgradeable;
  let Fenix: Fenix;
  let StrategyFactory: CompoundVeNESTManagedNFTStrategyFactoryUpgradeable;
  let routerV2: RouterV2;
  let routerV2PathProvider: RouterV2PathProviderUpgradeable;

  async function deployStrategyFactory() {
    StrategyFactory = (await ethers.getContractAt(
      'CompoundVeNESTManagedNFTStrategyFactoryUpgradeable',
      (
        await deployTransaperntUpgradeableProxy(
          signers.deployer,
          signers.proxyAdmin.address,
          await (await ethers.deployContract('CompoundVeNESTManagedNFTStrategyFactoryUpgradeable', [])).getAddress(),
        )
      ).target,
    )) as CompoundVeNESTManagedNFTStrategyFactoryUpgradeable;

    routerV2PathProvider = (await ethers.getContractFactory('RouterV2PathProviderUpgradeable')).attach(
      (
        await deployTransaperntUpgradeableProxy(
          signers.deployer,
          signers.proxyAdmin.address,
          await (await ethers.deployContract('RouterV2PathProviderUpgradeable', [])).getAddress(),
        )
      ).target,
    ) as RouterV2PathProviderUpgradeable;

    routerV2 = await ethers.deployContract('RouterV2', [deployed.v2PairFactory.target, ethers.Wallet.createRandom()]);

    await routerV2PathProvider.initialize(deployed.v2PairFactory.target, routerV2.target);

    await StrategyFactory.initialize(
      (
        await ethers.deployContract('CompoundVeNESTManagedNFTStrategyUpgradeable', [])
      ).target,
      (
        await ethers.deployContract('SingelTokenVirtualRewarderUpgradeable', [])
      ).target,
      ManagedNFTManager.target,
      routerV2PathProvider.target,
    );
  }

  async function newStrategy(name: string) {
    let strategy = await ethers.getContractAt(
      'CompoundVeNESTManagedNFTStrategyUpgradeable',
      await StrategyFactory.createStrategy.staticCall(name),
    );
    await StrategyFactory.createStrategy(name);
    return strategy;
  }

  async function newPool(token0: string, token1: string) {
    let t0 = await deployERC20MockToken(signers.deployer, token0, token0, 18);
    let t1 = await deployERC20MockToken(signers.deployer, token1, token1, 18);
    await deployed.v2PairFactory.createPair(t0.target, t1.target, false);
    return deployed.v2PairFactory.getPair(t0.target, t1.target, false);
  }

  let strategies: CompoundVeNESTManagedNFTStrategyUpgradeable[] = [];
  let pools: string[] = [];
  let mVeNfts: bigint[] = [];
  let otherUser1VeNftTokenId: bigint;
  let otherUser2VeNftTokenId: bigint;

  beforeEach(async function () {
    deployed = await loadFixture(completeFixture);
    signers = deployed.signers;
    Fenix = deployed.fenix;
    Voter = deployed.voter;
    VotingEscrow = deployed.votingEscrow;
    ManagedNFTManager = deployed.managedNFTManager;

    await deployStrategyFactory();

    for (let index = 0; index < 3; index++) {
      let strategi = await newStrategy('Strategi' + index);
      strategies.push(strategi);
      await ManagedNFTManager.createManagedNFT(strategi.target);
      let mVeNft = await VotingEscrow.lastMintedTokenId();
      mVeNfts.push(mVeNft);

      await ManagedNFTManager.setWhitelistedNFT(mVeNft, true);
      await ManagedNFTManager.setAuthorizedUser(mVeNft, signers.deployer.address);

      let pool = await newPool('token0' + index, 'token1' + index);
      await Voter.createV2Gauge(pool);
      pools.push(pool);
    }

    await Fenix.approve(VotingEscrow.target, ethers.MaxUint256);

    await VotingEscrow.createLockFor(ethers.parseEther('100'), 0, signers.otherUser1.address, false, true, 0);
    otherUser1VeNftTokenId = await VotingEscrow.lastMintedTokenId();

    await VotingEscrow.createLockFor(ethers.parseEther('100'), 0, signers.otherUser2.address, false, true, 0);
    otherUser2VeNftTokenId = await VotingEscrow.lastMintedTokenId();
  });

  describe('should success fix votes', async () => {
    async function checkVotesOnZeroState() {
      let currentEpoch = await deployed.minter.active_period();
      let prevEpoch = currentEpoch - BigInt(WEEK);
      let nextEpoch = currentEpoch + BigInt(WEEK);

      expect(await Voter.totalWeightsPerEpoch(currentEpoch)).to.be.eq(ZERO);
      expect(await Voter.totalWeightsPerEpoch(prevEpoch)).to.be.eq(ZERO);
      expect(await Voter.totalWeightsPerEpoch(nextEpoch)).to.be.eq(ZERO);
      for (let index = 0; index < pools.length; index++) {
        expect(await Voter.weightsPerEpoch(currentEpoch, pools[index])).to.be.eq(ZERO);
      }
      for (let index = 1; index <= otherUser2VeNftTokenId; index++) {
        expect(await Voter.poolVoteLength(index)).to.be.eq(ZERO);
      }
    }
    it('power after fix should be correct', async () => {
      await checkVotesOnZeroState();
      let currentEpoch = await deployed.minter.active_period();

      await Voter.connect(signers.otherUser1).attachToManagedNFT(otherUser1VeNftTokenId, mVeNfts[0]);
      await Voter.connect(signers.otherUser2).attachToManagedNFT(otherUser2VeNftTokenId, mVeNfts[0]);

      await strategies[0].vote([pools[0], pools[1]], [100, 100]);
      expect(await Voter.weightsPerEpoch(currentEpoch, pools[0])).to.be.eq(ethers.parseEther('100'));
      expect(await Voter.weightsPerEpoch(currentEpoch, pools[1])).to.be.eq(ethers.parseEther('100'));
      expect(await Voter.totalWeightsPerEpoch(currentEpoch)).to.be.eq(ethers.parseEther('200'));
      expect(await Voter.votes(mVeNfts[0], pools[0])).to.be.eq(ethers.parseEther('100'));
      expect(await Voter.votes(mVeNfts[0], pools[1])).to.be.eq(ethers.parseEther('100'));

      let tx = await Voter.fixVotePower();
      await expect(tx).to.be.emit(Voter, 'Abstained').withArgs(mVeNfts[0], ethers.parseEther('100'));
      await expect(tx).to.be.emit(Voter, 'Abstained').withArgs(mVeNfts[0], ethers.parseEther('100'));
      await expect(tx).to.be.emit(Voter, 'Voted').withArgs(signers.deployer.address, mVeNfts[0], ethers.parseEther('100'));
      expect(await Voter.votes(mVeNfts[0], pools[0])).to.be.eq(ethers.parseEther('100'));
      expect(await Voter.votes(mVeNfts[0], pools[1])).to.be.eq(ethers.parseEther('100'));

      expect(await Voter.weightsPerEpoch(currentEpoch, pools[0])).to.be.eq(ethers.parseEther('100'));
      expect(await Voter.weightsPerEpoch(currentEpoch, pools[1])).to.be.eq(ethers.parseEther('100'));
      expect(await Voter.totalWeightsPerEpoch(currentEpoch)).to.be.eq(ethers.parseEther('200'));

      await Voter.connect(signers.otherUser1).dettachFromManagedNFT(otherUser1VeNftTokenId);
      await Voter.connect(signers.otherUser2).dettachFromManagedNFT(otherUser2VeNftTokenId);
      await checkVotesOnZeroState();
    });
  });
});
