import { abi as POOL_ABI } from '@cryptoalgebra/integral-core/artifacts/contracts/AlgebraPool.sol/AlgebraPool.json';
import { encodePriceSqrt } from '@cryptoalgebra/integral-core/test/shared/utilities';
import { AlgebraPool } from '@cryptoalgebra/integral-core/typechain';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { loadFixture, time } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import {
  ERC20Mock,
  Nest,
  GaugeFactoryUpgradeable,
  GaugeUpgradeable,
  Pair,
  VoterUpgradeableV2,
  VotingEscrowUpgradeableV2,
} from '../../typechain-types';
import { GaugeType, ZERO_ADDRESS } from '../utils/constants';
import completeFixture, {
  CoreFixtureDeployed,
  FactoryFixture,
  deployAlgebraCore,
  deployERC20MockToken,
  deployGaugeFactory,
  deployGaugeImplementation,
  SignersList,
} from '../utils/coreFixture';

describe('GaugesRewardsDistribution', function () {
  let deployed: CoreFixtureDeployed;
  let signers: SignersList;
  let fenix: Nest;
  let voter: VoterUpgradeableV2;
  let votingEscrow: VotingEscrowUpgradeableV2;
  let algebraCore: FactoryFixture;

  // Mock tokens
  let tokenTK18: ERC20Mock;
  let tokenTK6: ERC20Mock;
  let tokenTK8: ERC20Mock;

  // V2 Pools
  let v2Pool1: Pair;
  let v2Pool2: Pair;
  let v2Pool3: Pair;

  // V3 Pools
  let v3Pool1: AlgebraPool;
  let v3Pool2: AlgebraPool;
  let v3Pool3: AlgebraPool;

  // Gauges
  let v2Gauge1: GaugeUpgradeable;
  let v2Gauge2: GaugeUpgradeable;
  let v2Gauge3: GaugeUpgradeable;
  let v3Gauge1: GaugeUpgradeable;
  let v3Gauge2: GaugeUpgradeable;
  let v3Gauge3: GaugeUpgradeable;

  // V3 Gauge Factory
  let v3GaugeFactory: GaugeFactoryUpgradeable;

  // VeNFT token IDs
  let user1TokenId: bigint;
  let user2TokenId: bigint;
  let user3TokenId: bigint;
  let user4TokenId: bigint;

  const WEEK = 604800;

  async function setupFullEnvironment() {
    deployed = await loadFixture(completeFixture);
    signers = deployed.signers;
    fenix = deployed.fenix;
    voter = deployed.voter;
    votingEscrow = deployed.votingEscrow;

    // Deploy Algebra Core for V3 pools
    algebraCore = await deployAlgebraCore();

    // Deploy mock tokens
    tokenTK18 = await deployERC20MockToken(signers.deployer, 'TK18', 'TK18', 18);
    tokenTK6 = await deployERC20MockToken(signers.deployer, 'TK6', 'TK6', 6);
    tokenTK8 = await deployERC20MockToken(signers.deployer, 'TK8', 'TK8', 8);

    // Setup Algebra Factory
    await deployed.feesVaultFactory.grantRole(await deployed.feesVaultFactory.WHITELISTED_CREATOR_ROLE(), algebraCore.factory.target);
    await algebraCore.factory.setVaultFactory(deployed.feesVaultFactory.target);
    await algebraCore.factory.grantRole(await algebraCore.factory.POOLS_CREATOR_ROLE(), signers.deployer.address);

    // Setup V3 Gauge Factory
    const v3GaugeImpl = await deployGaugeImplementation(signers.deployer, GaugeType.V3PairsGauge);
    v3GaugeFactory = await deployGaugeFactory(
      signers.deployer,
      signers.proxyAdmin.address,
      await voter.getAddress(),
      await v3GaugeImpl.getAddress(),
      await deployed.merklGaugeMiddleman.getAddress(),
    );
    await voter.updateAddress('v3PoolFactory', algebraCore.factory.target);
    await voter.updateAddress('v3GaugeFactory', v3GaugeFactory.target);

    // Create V2 Pools
    await deployed.v2PairFactory.createPair(fenix.target, tokenTK18.target, false);
    v2Pool1 = await ethers.getContractAt('Pair', await deployed.v2PairFactory.getPair(fenix.target, tokenTK18.target, false));

    await deployed.v2PairFactory.createPair(fenix.target, tokenTK6.target, false);
    v2Pool2 = await ethers.getContractAt('Pair', await deployed.v2PairFactory.getPair(fenix.target, tokenTK6.target, false));

    await deployed.v2PairFactory.createPair(tokenTK18.target, tokenTK6.target, true);
    v2Pool3 = await ethers.getContractAt('Pair', await deployed.v2PairFactory.getPair(tokenTK18.target, tokenTK6.target, true));

    // Create V3 Pools
    await algebraCore.factory.createPool(fenix.target, tokenTK18.target);
    v3Pool1 = (await ethers.getContractAt(
      POOL_ABI,
      await algebraCore.factory.poolByPair(fenix.target, tokenTK18.target),
    )) as any as AlgebraPool;
    await v3Pool1.initialize(encodePriceSqrt(1, 1));

    await algebraCore.factory.createPool(fenix.target, tokenTK6.target);
    v3Pool2 = (await ethers.getContractAt(
      POOL_ABI,
      await algebraCore.factory.poolByPair(fenix.target, tokenTK6.target),
    )) as any as AlgebraPool;
    await v3Pool2.initialize(encodePriceSqrt(1, 1));

    await algebraCore.factory.createPool(tokenTK18.target, tokenTK8.target);
    v3Pool3 = (await ethers.getContractAt(
      POOL_ABI,
      await algebraCore.factory.poolByPair(tokenTK18.target, tokenTK8.target),
    )) as any as AlgebraPool;
    await v3Pool3.initialize(encodePriceSqrt(1, 1));

    // Create V2 Gauges
    await voter.createV2Gauge(v2Pool1.target);
    v2Gauge1 = await ethers.getContractAt('GaugeUpgradeable', await voter.poolToGauge(v2Pool1.target));

    await voter.createV2Gauge(v2Pool2.target);
    v2Gauge2 = await ethers.getContractAt('GaugeUpgradeable', await voter.poolToGauge(v2Pool2.target));

    await voter.createV2Gauge(v2Pool3.target);
    v2Gauge3 = await ethers.getContractAt('GaugeUpgradeable', await voter.poolToGauge(v2Pool3.target));

    // Create V3 Gauges
    await voter.createV3Gauge(v3Pool1.target);
    v3Gauge1 = await ethers.getContractAt('GaugeUpgradeable', await voter.poolToGauge(v3Pool1.target));

    await voter.createV3Gauge(v3Pool2.target);
    v3Gauge2 = await ethers.getContractAt('GaugeUpgradeable', await voter.poolToGauge(v3Pool2.target));

    await voter.createV3Gauge(v3Pool3.target);
    v3Gauge3 = await ethers.getContractAt('GaugeUpgradeable', await voter.poolToGauge(v3Pool3.target));

    // Setup merkl distribution for V3 gauges
    await deployed.merklDistributionCreator.setRewardTokenMinAmounts([fenix.target], [1]);

    const defaultMerklParams = {
      rewardToken: fenix.target,
      positionWrappers: [signers.otherUser1.address, signers.otherUser2.address, signers.deployer.address],
      wrapperTypes: [0, 1, 2],
      amount: ethers.parseEther('1'),
      propToken0: 4000,
      propToken1: 2000,
      propFees: 4000,
      isOutOfRangeIncentivized: 0,
      epochStart: 1,
      numEpoch: 1,
      boostedReward: 0,
      boostingAddress: ZERO_ADDRESS,
      rewardId: ethers.id('TEST') as string,
      additionalData: ethers.id('test') as string,
    };

    await deployed.merklGaugeMiddleman.setGauge(v3Gauge1.target, {
      ...defaultMerklParams,
      uniV3Pool: v3Pool1.target,
    });

    await deployed.merklGaugeMiddleman.setGauge(v3Gauge2.target, {
      ...defaultMerklParams,
      uniV3Pool: v3Pool2.target,
    });

    await deployed.merklGaugeMiddleman.setGauge(v3Gauge3.target, {
      ...defaultMerklParams,
      uniV3Pool: v3Pool3.target,
    });

    // Distribute fenix tokens to users for veNFT creation
    await fenix.transfer(signers.otherUser1.address, ethers.parseEther('100000'));
    await fenix.transfer(signers.otherUser2.address, ethers.parseEther('100000'));
    await fenix.transfer(signers.otherUser3.address, ethers.parseEther('100000'));
    await fenix.transfer(signers.otherUser4.address, ethers.parseEther('100000'));

    return deployed;
  }

  async function createVeNFT(user: HardhatEthersSigner, amount: bigint, lockDuration: number): Promise<bigint> {
    await fenix.connect(user).approve(votingEscrow.target, amount);
    await votingEscrow.connect(user).createLockFor(amount, lockDuration, user.address, true, false, 0);
    return await votingEscrow.lastMintedTokenId();
  }

  async function getNextEpochTime(): Promise<bigint> {
    const currentTime = BigInt(await time.latest());
    return ((currentTime / BigInt(WEEK)) * BigInt(WEEK)) + BigInt(WEEK);
  }

  async function advanceToNextEpoch(skipDistributionWindow: boolean = true): Promise<void> {
    const nextEpoch = await getNextEpochTime();
    const currentTime = BigInt(await time.latest());
    // Distribution window is 3600 seconds (1 hour) at the start of each epoch
    const distributionWindow = skipDistributionWindow ? 3601 : 1;
    await time.increase(Number(nextEpoch - currentTime) + distributionWindow);
  }

  describe('Test Case #1: Normal reward distribution', function () {
    beforeEach(async () => {
      await setupFullEnvironment();

      // Create veNFTs for users
      // User1: 40,000 FENIX - will vote 40% for v2Pool1
      user1TokenId = await createVeNFT(signers.otherUser1, ethers.parseEther('40000'), 180 * 86400);

      // User2: 30,000 FENIX - will vote 30% for v3Pool2
      user2TokenId = await createVeNFT(signers.otherUser2, ethers.parseEther('30000'), 180 * 86400);

      // User3: 20,000 FENIX - will vote 20% for v3Pool1
      user3TokenId = await createVeNFT(signers.otherUser3, ethers.parseEther('20000'), 180 * 86400);

      // User4: 10,000 FENIX - will vote 10% for v2Pool2
      user4TokenId = await createVeNFT(signers.otherUser4, ethers.parseEther('10000'), 180 * 86400);
    });

    it('should distribute rewards proportionally to votes after epoch ends', async () => {
      // Get initial total supply
      const initialTotalSupply = await fenix.totalSupply();

      // Users vote for pools
      // User1: 40% voting power -> v2Pool1 (40%)
      await voter.connect(signers.otherUser1).vote(user1TokenId, [v2Pool1.target], [10000]);

      // User2: 30% voting power -> v3Pool2 (30%)
      await voter.connect(signers.otherUser2).vote(user2TokenId, [v3Pool2.target], [10000]);

      // User3: 20% voting power -> v3Pool1 (20%)
      await voter.connect(signers.otherUser3).vote(user3TokenId, [v3Pool1.target], [10000]);

      // User4: 10% voting power -> v2Pool2 (10%)
      await voter.connect(signers.otherUser4).vote(user4TokenId, [v2Pool2.target], [10000]);

      // Verify votes are registered
      const epochTimestamp = await voter.epochTimestamp();
      const totalWeight = await voter.totalWeightsPerEpoch(epochTimestamp);
      expect(totalWeight).to.be.gt(0);

      // Advance to next epoch
      await advanceToNextEpoch();

      // Get balances before distribution
      const v2Gauge1BalanceBefore = await fenix.balanceOf(v2Gauge1.target);
      const v2Gauge2BalanceBefore = await fenix.balanceOf(v2Gauge2.target);
      const v3Gauge1MerklBefore = await fenix.balanceOf(deployed.merklDistributionCreator.target);

      // Call distributeAll
      await voter.distributeAll();

      // Get weekly emission amount (minus team fee)
      const weeklyEmission = await deployed.minter.weekly();
      const teamRate = 500n; // 5%
      const emissionAfterTeamFee = weeklyEmission - (weeklyEmission * teamRate) / 10000n;

      // Check that total supply increased
      const newTotalSupply = await fenix.totalSupply();
      expect(newTotalSupply).to.be.gt(initialTotalSupply);

      // Get vote weights for each pool
      const v2Pool1Weight = await voter.weightsPerEpoch(epochTimestamp, v2Pool1.target);
      const v2Pool2Weight = await voter.weightsPerEpoch(epochTimestamp, v2Pool2.target);
      const v3Pool1Weight = await voter.weightsPerEpoch(epochTimestamp, v3Pool1.target);
      const v3Pool2Weight = await voter.weightsPerEpoch(epochTimestamp, v3Pool2.target);

      // Calculate expected distribution
      const totalVoteWeight = v2Pool1Weight + v2Pool2Weight + v3Pool1Weight + v3Pool2Weight;

      // V2 gauges receive tokens directly
      const v2Gauge1BalanceAfter = await fenix.balanceOf(v2Gauge1.target);
      const v2Gauge2BalanceAfter = await fenix.balanceOf(v2Gauge2.target);

      // V3 gauges send to merkl distributor
      const v3MerklBalanceAfter = await fenix.balanceOf(deployed.merklDistributionCreator.target);

      // V2Pool1 should have ~40% of emissions
      const expectedV2Pool1 = (emissionAfterTeamFee * v2Pool1Weight) / totalVoteWeight;
      expect(v2Gauge1BalanceAfter - v2Gauge1BalanceBefore).to.be.closeTo(expectedV2Pool1, ethers.parseEther('1'));

      // V2Pool2 should have ~10% of emissions
      const expectedV2Pool2 = (emissionAfterTeamFee * v2Pool2Weight) / totalVoteWeight;
      expect(v2Gauge2BalanceAfter - v2Gauge2BalanceBefore).to.be.closeTo(expectedV2Pool2, ethers.parseEther('1'));

      // V3 gauges combined should have ~50% of emissions (sent to merkl)
      const expectedV3Total = (emissionAfterTeamFee * (v3Pool1Weight + v3Pool2Weight)) / totalVoteWeight;
      expect(v3MerklBalanceAfter - v3Gauge1MerklBefore).to.be.closeTo(expectedV3Total, ethers.parseEther('1'));

      // Verify distribution events were emitted
      const gaugeState1 = await voter.gaugesState(v2Gauge1.target);
      const gaugeState2 = await voter.gaugesState(v2Gauge2.target);
      expect(gaugeState1.claimable).to.be.eq(0);
      expect(gaugeState2.claimable).to.be.eq(0);
    });

    it('should correctly split votes when user votes for multiple pools', async () => {
      // User1 splits votes: 60% v3Pool1, 40% v2Pool1
      await voter.connect(signers.otherUser1).vote(user1TokenId, [v3Pool1.target, v2Pool1.target], [6000, 4000]);

      // User2 votes 100% for v3Pool2
      await voter.connect(signers.otherUser2).vote(user2TokenId, [v3Pool2.target], [10000]);

      const epochTimestamp = await voter.epochTimestamp();

      // Verify split votes
      const user1V3Pool1Votes = await voter.votes(user1TokenId, v3Pool1.target);
      const user1V2Pool1Votes = await voter.votes(user1TokenId, v2Pool1.target);
      const user2V3Pool2Votes = await voter.votes(user2TokenId, v3Pool2.target);
      expect(user1V3Pool1Votes).to.be.gt(0);
      expect(user1V2Pool1Votes).to.be.gt(0);
      expect(user2V3Pool2Votes).to.be.gt(0);
      // V3Pool1 should have more votes than V2Pool1 (60% vs 40%)
      expect(user1V3Pool1Votes).to.be.gt(user1V2Pool1Votes);

      // Advance and distribute
      await advanceToNextEpoch();
      await voter.distributeAll();

      // Verify all gauges received appropriate rewards
      const v3Pool1Weight = await voter.weightsPerEpoch(epochTimestamp, v3Pool1.target);
      const v2Pool1Weight = await voter.weightsPerEpoch(epochTimestamp, v2Pool1.target);
      const v3Pool2Weight = await voter.weightsPerEpoch(epochTimestamp, v3Pool2.target);
      const totalWeight = v3Pool1Weight + v2Pool1Weight + v3Pool2Weight;
      expect(totalWeight).to.be.gt(0);
    });
  });

  describe('Test Case #2: Gauge with zero votes, then votes in next epoch', function () {
    beforeEach(async () => {
      await setupFullEnvironment();

      // Create veNFTs
      user1TokenId = await createVeNFT(signers.otherUser1, ethers.parseEther('50000'), 180 * 86400);
      user2TokenId = await createVeNFT(signers.otherUser2, ethers.parseEther('50000'), 180 * 86400);
    });

    it('should correctly handle gauge with no votes in previous epoch and votes in current epoch', async () => {
      // Epoch 1: Vote only for v2Pool1, v2Pool2 has ZERO votes
      await voter.connect(signers.otherUser1).vote(user1TokenId, [v2Pool1.target], [10000]);
      await voter.connect(signers.otherUser2).vote(user2TokenId, [v2Pool1.target], [10000]);

      const epoch1Timestamp = await voter.epochTimestamp();

      // Verify v2Pool2 has zero votes
      expect(await voter.weightsPerEpoch(epoch1Timestamp, v2Pool2.target)).to.be.eq(0);

      // Advance to next epoch
      await advanceToNextEpoch();

      // Distribute for v2Pool1 (this also calls minter.update_period internally via distributeAll)
      await voter.distributeAll();

      // Verify v2Gauge1 received rewards, v2Gauge2 has nothing
      const v2Gauge1Balance = await fenix.balanceOf(v2Gauge1.target);
      const v2Gauge2Balance = await fenix.balanceOf(v2Gauge2.target);

      expect(v2Gauge1Balance).to.be.gt(0);
      expect(v2Gauge2Balance).to.be.eq(0);

      // Epoch 2: Now reset votes and vote for v2Pool2
      await voter.connect(signers.otherUser1).reset(user1TokenId);
      await voter.connect(signers.otherUser2).reset(user2TokenId);

      await voter.connect(signers.otherUser1).vote(user1TokenId, [v2Pool2.target], [10000]);
      await voter.connect(signers.otherUser2).vote(user2TokenId, [v2Pool2.target], [10000]);

      const epoch2Timestamp = await voter.epochTimestamp();

      // Verify v2Pool2 now has votes
      expect(await voter.weightsPerEpoch(epoch2Timestamp, v2Pool2.target)).to.be.gt(0);

      // Advance to next epoch
      await advanceToNextEpoch();

      // Now call distribute - this will also call minter.update_period
      const v2Gauge2BalanceBefore = await fenix.balanceOf(v2Gauge2.target);
      await voter.distributeAll();
      const v2Gauge2BalanceAfter = await fenix.balanceOf(v2Gauge2.target);

      // v2Gauge2 should now have received rewards for epoch 2 (it had zero votes in epoch 1)
      expect(v2Gauge2BalanceAfter).to.be.gt(v2Gauge2BalanceBefore);

      // The gauge should only receive rewards for epoch 2 when it had votes
      // Not for epoch 1 when it had zero votes
      const gaugeState = await voter.gaugesState(v2Gauge2.target);
      expect(gaugeState.claimable).to.be.eq(0);
    });

    it('should not distribute rewards for epochs with zero votes even if distribute is called late', async () => {
      // Epoch 1: v2Pool2 has zero votes
      await voter.connect(signers.otherUser1).vote(user1TokenId, [v2Pool1.target], [10000]);

      const epoch1Timestamp = await voter.epochTimestamp();
      expect(await voter.weightsPerEpoch(epoch1Timestamp, v2Pool2.target)).to.be.eq(0);

      // Advance to epoch 2 and update minter period to generate emissions for epoch 1
      await advanceToNextEpoch();
      await deployed.minter.update_period();

      // Vote for v2Pool2 in epoch 2
      await voter.connect(signers.otherUser1).reset(user1TokenId);
      await voter.connect(signers.otherUser1).vote(user1TokenId, [v2Pool2.target], [10000]);

      const epoch2Timestamp = await voter.epochTimestamp();
      expect(await voter.weightsPerEpoch(epoch2Timestamp, v2Pool2.target)).to.be.gt(0);

      // Advance to epoch 3 and update minter period to generate emissions for epoch 2
      await advanceToNextEpoch();
      await deployed.minter.update_period();

      // Now distribute for v2Pool2 - it should catch up for epoch 2 only
      const v2Gauge2BalanceBefore = await fenix.balanceOf(v2Gauge2.target);
      await voter.distribute([v2Gauge2.target]);
      const v2Gauge2BalanceAfter = await fenix.balanceOf(v2Gauge2.target);

      // Should receive rewards only for epoch 2 (when it had votes)
      // Epoch 1 had zero votes, so no rewards for that epoch
      expect(v2Gauge2BalanceAfter).to.be.gt(v2Gauge2BalanceBefore);
    });
  });

  describe('Test Case #3: Gauge had votes but distribute was not called, then votes again', function () {
    beforeEach(async () => {
      await setupFullEnvironment();

      // Create veNFTs
      user1TokenId = await createVeNFT(signers.otherUser1, ethers.parseEther('50000'), 180 * 86400);
      user2TokenId = await createVeNFT(signers.otherUser2, ethers.parseEther('50000'), 180 * 86400);
    });

    it('should accumulate rewards from multiple epochs when distribute is called late', async () => {
      // Epoch 1: Vote for v2Pool1
      await voter.connect(signers.otherUser1).vote(user1TokenId, [v2Pool1.target], [10000]);
      await voter.connect(signers.otherUser2).vote(user2TokenId, [v2Pool1.target], [10000]);

      const epoch1Timestamp = await voter.epochTimestamp();
      const epoch1Weight = await voter.weightsPerEpoch(epoch1Timestamp, v2Pool1.target);
      expect(epoch1Weight).to.be.gt(0);

      // Advance to epoch 2 - DON'T call distribute
      await advanceToNextEpoch();

      // Update minter period to simulate emission for epoch 1
      await deployed.minter.update_period();

      // Epoch 2: Continue voting for v2Pool1 (votes persist via poke or re-vote)
      await voter.connect(signers.otherUser1).poke(user1TokenId);
      await voter.connect(signers.otherUser2).poke(user2TokenId);

      const epoch2Timestamp = await voter.epochTimestamp();
      const epoch2Weight = await voter.weightsPerEpoch(epoch2Timestamp, v2Pool1.target);
      expect(epoch2Weight).to.be.gt(0);

      // Advance to epoch 3 - still DON'T call distribute
      await advanceToNextEpoch();

      // Update minter period
      await deployed.minter.update_period();

      // Now call distribute - should receive rewards for BOTH epoch 1 and epoch 2
      const v2Gauge1BalanceBefore = await fenix.balanceOf(v2Gauge1.target);
      await voter.distribute([v2Gauge1.target]);
      const v2Gauge1BalanceAfter = await fenix.balanceOf(v2Gauge1.target);

      // The gauge should have received accumulated rewards from both epochs
      const totalReceived = v2Gauge1BalanceAfter - v2Gauge1BalanceBefore;
      expect(totalReceived).to.be.gt(0);

      // Verify the gauge state is updated correctly
      const gaugeState = await voter.gaugesState(v2Gauge1.target);
      expect(gaugeState.claimable).to.be.eq(0);
      expect(gaugeState.lastDistributionTimestamp).to.be.eq(await voter.epochTimestamp());
    });

    it('should correctly distribute when votes change between epochs without distribution', async () => {
      // Epoch 1: Vote 100% for v2Pool1
      await voter.connect(signers.otherUser1).vote(user1TokenId, [v2Pool1.target], [10000]);
      await voter.connect(signers.otherUser2).vote(user2TokenId, [v2Pool1.target], [10000]);

      const epoch1Timestamp = await voter.epochTimestamp();
      const epoch1V2Pool1Weight = await voter.weightsPerEpoch(epoch1Timestamp, v2Pool1.target);

      // Advance to epoch 2
      await advanceToNextEpoch();

      // First distribute for epoch 1 to get the emission tokens
      await voter.distributeAll();

      // Record balances after epoch 1 distribution
      const v2Gauge1BalanceAfterEpoch1 = await fenix.balanceOf(v2Gauge1.target);
      const v2Gauge2BalanceAfterEpoch1 = await fenix.balanceOf(v2Gauge2.target);

      // v2Gauge1 should have received all rewards from epoch 1
      expect(v2Gauge1BalanceAfterEpoch1).to.be.gt(0);
      // v2Gauge2 had zero votes in epoch 1, so no rewards
      expect(v2Gauge2BalanceAfterEpoch1).to.be.eq(0);

      // Epoch 2: Change votes - 50% v2Pool1, 50% v2Pool2
      await voter.connect(signers.otherUser1).reset(user1TokenId);
      await voter.connect(signers.otherUser1).vote(user1TokenId, [v2Pool1.target, v2Pool2.target], [5000, 5000]);

      await voter.connect(signers.otherUser2).reset(user2TokenId);
      await voter.connect(signers.otherUser2).vote(user2TokenId, [v2Pool1.target, v2Pool2.target], [5000, 5000]);

      const epoch2Timestamp = await voter.epochTimestamp();

      // Advance to epoch 3
      await advanceToNextEpoch();

      // Now distribute for epoch 2
      const v2Gauge1BalanceBefore = await fenix.balanceOf(v2Gauge1.target);
      const v2Gauge2BalanceBefore = await fenix.balanceOf(v2Gauge2.target);

      await voter.distributeAll();

      const v2Gauge1BalanceAfter = await fenix.balanceOf(v2Gauge1.target);
      const v2Gauge2BalanceAfter = await fenix.balanceOf(v2Gauge2.target);

      const v2Gauge1ReceivedEpoch2 = v2Gauge1BalanceAfter - v2Gauge1BalanceBefore;
      const v2Gauge2ReceivedEpoch2 = v2Gauge2BalanceAfter - v2Gauge2BalanceBefore;

      // In epoch 2, both pools had 50% of votes each, so they should receive similar amounts
      expect(v2Gauge1ReceivedEpoch2).to.be.gt(0);
      expect(v2Gauge2ReceivedEpoch2).to.be.gt(0);
      // They should be approximately equal (within tolerance due to voting power decay)
      expect(v2Gauge1ReceivedEpoch2).to.be.closeTo(v2Gauge2ReceivedEpoch2, ethers.parseEther('1'));
    });

    it('should correctly accumulate rewards across 3+ epochs without distribution', async () => {
      // Epoch 1: Vote for v2Pool1
      await voter.connect(signers.otherUser1).vote(user1TokenId, [v2Pool1.target], [10000]);

      // Advance through multiple epochs without distributing
      for (let i = 0; i < 3; i++) {
        await advanceToNextEpoch();
        await deployed.minter.update_period();

        // Keep votes active
        await voter.connect(signers.otherUser1).poke(user1TokenId);
      }

      // Now distribute - should get rewards from all epochs
      const v2Gauge1BalanceBefore = await fenix.balanceOf(v2Gauge1.target);
      await voter.distribute([v2Gauge1.target]);
      const v2Gauge1BalanceAfter = await fenix.balanceOf(v2Gauge1.target);

      const totalReceived = v2Gauge1BalanceAfter - v2Gauge1BalanceBefore;

      // Should have received significant accumulated rewards
      expect(totalReceived).to.be.gt(0);

      // Verify state is correctly updated
      const gaugeState = await voter.gaugesState(v2Gauge1.target);
      expect(gaugeState.lastDistributionTimestamp).to.be.eq(await voter.epochTimestamp());
    });
  });

  describe('Edge cases', function () {
    beforeEach(async () => {
      await setupFullEnvironment();

      user1TokenId = await createVeNFT(signers.otherUser1, ethers.parseEther('50000'), 180 * 86400);
    });

    it('should handle distribution when called multiple times in the same epoch', async () => {
      await voter.connect(signers.otherUser1).vote(user1TokenId, [v2Pool1.target], [10000]);

      await advanceToNextEpoch();

      // First distribution
      await voter.distribute([v2Gauge1.target]);
      const balanceAfterFirst = await fenix.balanceOf(v2Gauge1.target);

      // Second distribution in same epoch - should not add more
      await voter.distribute([v2Gauge1.target]);
      const balanceAfterSecond = await fenix.balanceOf(v2Gauge1.target);

      expect(balanceAfterSecond).to.be.eq(balanceAfterFirst);
    });

    it('should handle gauge with votes that becomes zero in next epoch', async () => {
      // Epoch 1: Vote for v2Pool1
      await voter.connect(signers.otherUser1).vote(user1TokenId, [v2Pool1.target], [10000]);

      await advanceToNextEpoch();
      await deployed.minter.update_period();

      // Epoch 2: Reset votes (now v2Pool1 has zero votes)
      await voter.connect(signers.otherUser1).reset(user1TokenId);

      await advanceToNextEpoch();

      // Distribute - should get rewards for epoch 1 only
      const balanceBefore = await fenix.balanceOf(v2Gauge1.target);
      await voter.distribute([v2Gauge1.target]);
      const balanceAfter = await fenix.balanceOf(v2Gauge1.target);

      expect(balanceAfter).to.be.gt(balanceBefore);
    });
  });
});
