import { abi as POOL_ABI } from '@cryptoalgebra/integral-core/artifacts/contracts/AlgebraPool.sol/AlgebraPool.json';
import { encodePriceSqrt } from '@cryptoalgebra/integral-core/test/shared/utilities';
import { loadFixture, time } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { ERC20Mock, VoterUpgradeableV2, VotingEscrowUpgradeableV2 } from '../../../typechain-types';
import { ERRORS, GaugeType, getAccessControlError } from '../../utils/constants';
import completeFixture, {
  CoreFixtureDeployed,
  deployAlgebraCore,
  deployERC20MockToken,
  deployGaugeFactory,
  deployGaugeImplementation,
  FactoryFixture,
  SignersList,
} from '../../utils/coreFixture';

describe('VotingEscrow_V2', function () {
  let VotingEscrow: VotingEscrowUpgradeableV2;
  let Voter: VoterUpgradeableV2;
  let signers: SignersList;
  let token: ERC20Mock;
  let deployed: CoreFixtureDeployed;

  beforeEach(async () => {
    deployed = await loadFixture(completeFixture);
    VotingEscrow = deployed.votingEscrow;
    Voter = deployed.voter;
    signers = deployed.signers;
    token = await deployERC20MockToken(signers.deployer, 'MOK', 'MOK', 18);
  });

  async function getNextEpochTime() {
    return (BigInt(await time.latest()) / 604800n) * 604800n + 604800n;
  }

  async function updateMinterPeriod() {
    await deployed.minter.update_period();
  }

  async function setupV3GaugeEnvironment(): Promise<FactoryFixture> {
    const algebraCore = await deployAlgebraCore();

    await deployed.feesVaultFactory.grantRole(await deployed.feesVaultFactory.WHITELISTED_CREATOR_ROLE(), algebraCore.factory.target);
    await algebraCore.factory.setVaultFactory(deployed.feesVaultFactory.target);
    await algebraCore.factory.grantRole(await algebraCore.factory.POOLS_CREATOR_ROLE(), signers.deployer.address);

    const v3GaugeImplementation = await deployGaugeImplementation(signers.deployer, GaugeType.V3PairsGauge);
    const v3GaugeFactory = await deployGaugeFactory(
      signers.deployer,
      signers.proxyAdmin.address,
      await Voter.getAddress(),
      await v3GaugeImplementation.getAddress(),
      await deployed.merklGaugeMiddleman.getAddress(),
    );

    await Voter.updateAddress('v3PoolFactory', algebraCore.factory.target);
    await Voter.updateAddress('v3GaugeFactory', v3GaugeFactory.target);

    return algebraCore;
  }

  async function createClassicV3Pool(algebraCore: FactoryFixture, tokenA: string, tokenB: string) {
    const poolAddress = await algebraCore.factory.createPool.staticCall(tokenA, tokenB);
    await algebraCore.factory.createPool(tokenA, tokenB);
    const pool = await ethers.getContractAt(POOL_ABI, poolAddress);
    await pool.initialize(encodePriceSqrt(1, 1));
    return pool;
  }

  describe('Deployment', async () => {
    describe('should fail if', async () => {
      it('try call initialize on implementation', async () => {
        await expect(Voter.initialize(VotingEscrow.target)).to.be.revertedWith(ERRORS.Initializable.Initialized);
      });
      it('try recall initialize on proxy', async () => {
        await expect(Voter.initialize(token.target)).to.be.revertedWith(ERRORS.Initializable.Initialized);
      });
    });
    describe('State after deployment and initialization', async () => {
      it('caller should have DEFAULT_ADMIN_ROLE', async () => {
        expect(await Voter.hasRole(await Voter.DEFAULT_ADMIN_ROLE(), signers.deployer.address)).to.be.true;
      });

      it('votingEscrow', async () => {
        expect(await Voter.votingEscrow()).to.be.eq(VotingEscrow.target);
      });

      it('token', async () => {
        expect(await Voter.token()).to.be.eq(await VotingEscrow.token());
        expect(await Voter.token()).to.be.eq(deployed.fenix.target);
      });

      it('voteDelay', async () => {
        expect(await Voter.voteDelay()).to.be.eq(0);
      });

      it('minter', async () => {
        expect(await Voter.minter()).to.be.eq(deployed.minter.target);
      });

      it('distributionWindowDuration', async () => {
        expect(await Voter.distributionWindowDuration()).to.be.eq(3600);
      });
    });
  });

  describe('shoulf fail calls, if not pass checkSender', async () => {
    it('#notifyRewardAmount', async () => {
      await expect(Voter.notifyRewardAmount(1)).to.be.revertedWithCustomError(Voter, 'AccessDenied');
    });

    it('#onDepositToManagedNFT', async () => {
      await expect(Voter.onDepositToManagedNFT(1, 1)).to.be.revertedWithCustomError(Voter, 'AccessDenied');
    });

    it('#onAfterTokenTransfer', async () => {
      await expect(Voter.onAfterTokenTransfer(ethers.ZeroAddress, ethers.ZeroAddress, 1)).to.be.revertedWithCustomError(
        Voter,
        'AccessDenied',
      );
    });

    it('#onAfterTokenMerge', async () => {
      await expect(Voter.onAfterTokenTransfer(ethers.ZeroAddress, ethers.ZeroAddress, 1)).to.be.revertedWithCustomError(
        Voter,
        'AccessDenied',
      );
    });

    it('#onCompoundEmissionClaim', async () => {
      await expect(
        Voter.onCompoundEmissionClaim(ethers.ZeroAddress, [], { totalAmount: 0, signature: ethers.ZeroHash, deadline: 0 }),
      ).to.be.revertedWithCustomError(Voter, 'AccessDenied');
    });
  });

  describe('Access restricted functionality', async () => {
    describe('onDepositToManagedNFT', async () => {
      it('fail if call from not VotinEscrow', async () => {
        await expect(Voter.connect(signers.otherUser1).onDepositToManagedNFT(1, 1)).to.be.revertedWithCustomError(Voter, 'AccessDenied');
      });
    });
    describe('#setDistributionWindowDuration', async () => {
      it('fail if call from not VoterAdmin', async () => {
        await expect(Voter.connect(signers.otherUser1).setDistributionWindowDuration(3600)).to.be.revertedWith(
          getAccessControlError(ethers.id('VOTER_ADMIN_ROLE'), signers.otherUser1.address),
        );
      });
      it('success set new distribution window', async () => {
        expect(await Voter.distributionWindowDuration()).to.be.eq(3600);
        await expect(Voter.setDistributionWindowDuration(155)).to.be.emit(Voter, 'SetDistributionWindowDuration').withArgs(155);
        expect(await Voter.distributionWindowDuration()).to.be.eq(155);
      });
    });

    describe('#killGauge', async () => {
      it('should fail if call from not GOVERNANCE_ROLE', async () => {
        await expect(Voter.connect(signers.otherUser1).killGauge(ethers.ZeroAddress)).to.be.revertedWith(
          getAccessControlError(ethers.id('GOVERNANCE_ROLE'), signers.otherUser1.address),
        );
      });

      it('should fail if gauge not alive', async () => {
        await expect(Voter.killGauge(ethers.ZeroAddress)).to.be.revertedWithCustomError(Voter, 'GaugeAlreadyKilled');
      });

      it('success kill gauge', async () => {
        let pair = await deployed.v2PairFactory.createPair.staticCall(deployed.fenix.target, token.target, false);
        await deployed.v2PairFactory.createPair(deployed.fenix.target, token.target, false);
        await Voter.createV2Gauge(pair);
        let gauge = await Voter.poolToGauge(pair);

        // Create veNFT lock and vote for the pool
        await deployed.fenix.transfer(signers.otherUser1.address, ethers.parseEther('10'));
        await deployed.fenix.connect(signers.otherUser1).approve(VotingEscrow.target, ethers.parseEther('10'));
        await VotingEscrow.connect(signers.otherUser1).createLockFor(ethers.parseEther('10'), 15724800, signers.otherUser1.address, false, false, 0);

        // Vote for the pool
        await Voter.connect(signers.otherUser1).vote(1, [pair], [10000]);

        // Get epoch timestamp and check weights before killing
        let epochTimestamp = await Voter.epochTimestamp();
        let poolWeightBefore = await Voter.weightsPerEpoch(epochTimestamp, pair);
        let totalWeightBefore = await Voter.totalWeightsPerEpoch(epochTimestamp);

        expect(poolWeightBefore).to.be.gt(0);
        expect(totalWeightBefore).to.be.gte(poolWeightBefore);

        // Kill the gauge
        await expect(Voter.killGauge(gauge)).to.be.emit(Voter, 'GaugeKilled').withArgs(gauge);

        // Verify gauge state
        let gaugeState = await Voter.gaugesState(gauge);
        expect(gaugeState.isGauge).to.be.true;
        expect(gaugeState.isAlive).to.be.false;

        // Verify weights after killing
        let poolWeightAfter = await Voter.weightsPerEpoch(epochTimestamp, pair);
        let totalWeightAfter = await Voter.totalWeightsPerEpoch(epochTimestamp);

        expect(poolWeightAfter).to.be.eq(0);
        expect(totalWeightAfter).to.be.eq(totalWeightBefore - poolWeightBefore);
      });
    });
    describe('#reviveGauge', async () => {
      it('should fail if call from not GOVERNANCE_ROLE', async () => {
        await expect(Voter.connect(signers.otherUser1).reviveGauge(ethers.ZeroAddress)).to.be.revertedWith(
          getAccessControlError(ethers.id('GOVERNANCE_ROLE'), signers.otherUser1.address),
        );
      });

      it('should fail if gauge not klilled to revive', async () => {
        let pair = await deployed.v2PairFactory.createPair.staticCall(deployed.fenix.target, token.target, false);
        await deployed.v2PairFactory.createPair(deployed.fenix.target, token.target, false);
        await Voter.createV2Gauge(pair);
        let gauge = await Voter.poolToGauge(pair);

        await expect(Voter.reviveGauge(gauge)).to.be.revertedWithCustomError(Voter, 'GaugeNotKilled');
      });

      it('success revive gauge', async () => {
        let pair = await deployed.v2PairFactory.createPair.staticCall(deployed.fenix.target, token.target, false);
        await deployed.v2PairFactory.createPair(deployed.fenix.target, token.target, false);
        await Voter.createV2Gauge(pair);
        let gauge = await Voter.poolToGauge(pair);
        await Voter.killGauge(gauge);
        await expect(Voter.reviveGauge(gauge)).to.be.emit(Voter, 'GaugeRevived').withArgs(gauge);
        let gaugeState = await Voter.gaugesState(gauge);
        expect(gaugeState.isGauge).to.be.true;
        expect(gaugeState.isAlive).to.be.true;
      });
    });

    describe('distribution window', async () => {
      beforeEach(async () => {
        await deployed.fenix.transfer(signers.otherUser1.address, ethers.parseEther('2'));
        await deployed.fenix.connect(signers.otherUser1).approve(VotingEscrow.target, ethers.parseEther('100'));
        await VotingEscrow.connect(signers.otherUser1).createLockFor(ethers.parseEther('1'), 15724800, signers.otherUser1, false, false, 0);
      });

      describe('should fail if ', async () => {
        it('try use poke during vote window', async () => {
          let nextEpoch = await getNextEpochTime();
          await time.increaseTo(nextEpoch - 3600n + 1n);
          await expect(Voter.connect(signers.otherUser1).poke(1)).to.be.revertedWithCustomError(Voter, 'DistributionWindow');

          await time.increaseTo(nextEpoch);
          await updateMinterPeriod();
          await expect(Voter.connect(signers.otherUser1).poke(1)).to.be.revertedWithCustomError(Voter, 'DistributionWindow');

          await time.increaseTo(nextEpoch + 3600n - 1n);
          await expect(Voter.connect(signers.otherUser1).poke(1)).to.be.revertedWithCustomError(Voter, 'DistributionWindow');
          await time.increaseTo(nextEpoch + 3700n);
          await expect(Voter.connect(signers.otherUser1).poke(1)).to.be.not.revertedWithCustomError(Voter, 'DistributionWindow');
        });

        it('try use reset during vote window', async () => {
          let nextEpoch = await getNextEpochTime();
          await time.increaseTo(nextEpoch - 3600n + 1n);
          await expect(Voter.connect(signers.otherUser1).reset(1)).to.be.revertedWithCustomError(Voter, 'DistributionWindow');

          await time.increaseTo(nextEpoch);
          await updateMinterPeriod();
          await expect(Voter.connect(signers.otherUser1).reset(1)).to.be.revertedWithCustomError(Voter, 'DistributionWindow');

          await time.increaseTo(nextEpoch + 3600n - 1n);
          await expect(Voter.connect(signers.otherUser1).reset(1)).to.be.revertedWithCustomError(Voter, 'DistributionWindow');
          await time.increaseTo(nextEpoch + 3700n);
          await expect(Voter.connect(signers.otherUser1).reset(1)).to.be.not.revertedWithCustomError(Voter, 'DistributionWindow');
        });

        it('try use vote during vote window', async () => {
          let nextEpoch = await getNextEpochTime();
          await time.increaseTo(nextEpoch - 3600n + 1n);
          await expect(Voter.connect(signers.otherUser1).vote(1, [], [])).to.be.revertedWithCustomError(Voter, 'DistributionWindow');

          await time.increaseTo(nextEpoch);
          await updateMinterPeriod();
          await expect(Voter.connect(signers.otherUser1).vote(1, [], [])).to.be.revertedWithCustomError(Voter, 'DistributionWindow');

          await time.increaseTo(nextEpoch + 3600n - 1n);
          await expect(Voter.connect(signers.otherUser1).vote(1, [], [])).to.be.revertedWithCustomError(Voter, 'DistributionWindow');
          await time.increaseTo(nextEpoch + 3700n);
          await expect(Voter.connect(signers.otherUser1).vote(1, [], [])).to.be.not.revertedWithCustomError(Voter, 'DistributionWindow');
        });

        it('try use vote after epoch change before minter period is updated', async () => {
          let nextEpoch = await getNextEpochTime();
          await time.increaseTo(nextEpoch + 3700n);

          await expect(Voter.connect(signers.otherUser1).vote(1, [], [])).to.be.revertedWithCustomError(Voter, 'EpochNotFlipped');
        });
      });
    });

    describe('#updateAddress', async () => {
      describe('should fail if', async () => {
        it('call from not VOTER_ADMIN_ROLE', async () => {
          await expect(Voter.connect(signers.otherUser1).updateAddress('minter', ethers.ZeroAddress)).to.be.revertedWith(
            getAccessControlError(ethers.id('VOTER_ADMIN_ROLE'), signers.otherUser1.address),
          );
        });
        it('call with invalid key', async () => {
          await expect(Voter.updateAddress('1', ethers.ZeroAddress)).to.be.revertedWithCustomError(Voter, 'InvalidAddressKey');
        });
      });

      describe('success update and emit event', async () => {
        const TEST_ADDRESS = '0x1000000000000000000000000000000000000001';
        beforeEach(async () => {
          await Voter.updateAddress('minter', ethers.ZeroAddress);
          await Voter.updateAddress('bribeFactory', ethers.ZeroAddress);
          await Voter.updateAddress('gaugeRewarder', ethers.ZeroAddress);
          await Voter.updateAddress('veNestMerklAidrop', ethers.ZeroAddress);
          await Voter.updateAddress('managedNFTManager', ethers.ZeroAddress);
          await Voter.updateAddress('v2PoolFactory', ethers.ZeroAddress);
          await Voter.updateAddress('v3PoolFactory', ethers.ZeroAddress);
          await Voter.updateAddress('v2GaugeFactory', ethers.ZeroAddress);
          await Voter.updateAddress('v3GaugeFactory', ethers.ZeroAddress);
          await Voter.updateAddress('compoundEmissionExtension', ethers.ZeroAddress);

          expect(await Voter.minter()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.bribeFactory()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.gaugeRewarder()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.veNestMerklAidrop()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.managedNFTManager()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.v2PoolFactory()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.v3PoolFactory()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.v2GaugeFactory()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.v3GaugeFactory()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.compoundEmissionExtension()).to.be.eq(ethers.ZeroAddress);
        });

        it('compoundEmissionExtension', async () => {
          await expect(Voter.updateAddress('compoundEmissionExtension', deployed.compoundEmissionExtension.target))
            .to.be.emit(Voter, 'UpdateAddress')
            .withArgs('compoundEmissionExtension', deployed.compoundEmissionExtension.target);
          expect(await Voter.minter()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.bribeFactory()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.gaugeRewarder()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.veNestMerklAidrop()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.managedNFTManager()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.v2PoolFactory()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.v3PoolFactory()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.v2GaugeFactory()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.v3GaugeFactory()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.compoundEmissionExtension()).to.be.eq(deployed.compoundEmissionExtension.target);
        });

        it('minter', async () => {
          await expect(Voter.updateAddress('minter', deployed.minter.target))
            .to.be.emit(Voter, 'UpdateAddress')
            .withArgs('minter', deployed.minter.target);
          expect(await Voter.minter()).to.be.eq(deployed.minter.target);
          expect(await Voter.bribeFactory()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.gaugeRewarder()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.veNestMerklAidrop()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.managedNFTManager()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.v2PoolFactory()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.v3PoolFactory()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.v2GaugeFactory()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.v3GaugeFactory()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.compoundEmissionExtension()).to.be.eq(ethers.ZeroAddress);
        });

        it('bribeFactory', async () => {
          await expect(Voter.updateAddress('bribeFactory', deployed.bribeFactory.target))
            .to.be.emit(Voter, 'UpdateAddress')
            .withArgs('bribeFactory', deployed.bribeFactory.target);
          expect(await Voter.minter()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.bribeFactory()).to.be.eq(deployed.bribeFactory.target);
          expect(await Voter.gaugeRewarder()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.veNestMerklAidrop()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.managedNFTManager()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.v2PoolFactory()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.v3PoolFactory()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.v2GaugeFactory()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.v3GaugeFactory()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.compoundEmissionExtension()).to.be.eq(ethers.ZeroAddress);
        });

        it('gaugeRewarder', async () => {
          await expect(Voter.updateAddress('gaugeRewarder', deployed.merklDistributionCreator.target))
            .to.be.emit(Voter, 'UpdateAddress')
            .withArgs('gaugeRewarder', deployed.merklDistributionCreator.target);
          expect(await Voter.minter()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.bribeFactory()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.gaugeRewarder()).to.be.eq(deployed.merklDistributionCreator.target);
          expect(await Voter.veNestMerklAidrop()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.managedNFTManager()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.v2PoolFactory()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.v3PoolFactory()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.v2GaugeFactory()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.v3GaugeFactory()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.compoundEmissionExtension()).to.be.eq(ethers.ZeroAddress);
        });

        it('veNestMerklAidrop', async () => {
          await expect(Voter.updateAddress('veNestMerklAidrop', TEST_ADDRESS))
            .to.be.emit(Voter, 'UpdateAddress')
            .withArgs('veNestMerklAidrop', TEST_ADDRESS);
          expect(await Voter.minter()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.bribeFactory()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.gaugeRewarder()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.veNestMerklAidrop()).to.be.eq(TEST_ADDRESS);
          expect(await Voter.managedNFTManager()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.v2PoolFactory()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.v3PoolFactory()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.v2GaugeFactory()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.v3GaugeFactory()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.compoundEmissionExtension()).to.be.eq(ethers.ZeroAddress);
        });

        it('managedNFTManager', async () => {
          await expect(Voter.updateAddress('managedNFTManager', TEST_ADDRESS))
            .to.be.emit(Voter, 'UpdateAddress')
            .withArgs('managedNFTManager', TEST_ADDRESS);
          expect(await Voter.minter()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.bribeFactory()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.gaugeRewarder()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.veNestMerklAidrop()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.managedNFTManager()).to.be.eq(TEST_ADDRESS);
          expect(await Voter.v2PoolFactory()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.v3PoolFactory()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.v2GaugeFactory()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.v3GaugeFactory()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.compoundEmissionExtension()).to.be.eq(ethers.ZeroAddress);
        });

        it('v2PoolFactory', async () => {
          await expect(Voter.updateAddress('v2PoolFactory', TEST_ADDRESS))
            .to.be.emit(Voter, 'UpdateAddress')
            .withArgs('v2PoolFactory', TEST_ADDRESS);
          expect(await Voter.minter()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.bribeFactory()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.gaugeRewarder()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.veNestMerklAidrop()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.managedNFTManager()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.v2PoolFactory()).to.be.eq(TEST_ADDRESS);
          expect(await Voter.v3PoolFactory()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.v2GaugeFactory()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.v3GaugeFactory()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.compoundEmissionExtension()).to.be.eq(ethers.ZeroAddress);
        });

        it('v3PoolFactory', async () => {
          await expect(Voter.updateAddress('v3PoolFactory', TEST_ADDRESS))
            .to.be.emit(Voter, 'UpdateAddress')
            .withArgs('v3PoolFactory', TEST_ADDRESS);
          expect(await Voter.minter()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.bribeFactory()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.gaugeRewarder()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.veNestMerklAidrop()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.managedNFTManager()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.v2PoolFactory()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.v3PoolFactory()).to.be.eq(TEST_ADDRESS);
          expect(await Voter.v2GaugeFactory()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.v3GaugeFactory()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.compoundEmissionExtension()).to.be.eq(ethers.ZeroAddress);
        });
        it('v2GaugeFactory', async () => {
          await expect(Voter.updateAddress('v2GaugeFactory', TEST_ADDRESS))
            .to.be.emit(Voter, 'UpdateAddress')
            .withArgs('v2GaugeFactory', TEST_ADDRESS);
          expect(await Voter.minter()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.bribeFactory()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.gaugeRewarder()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.veNestMerklAidrop()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.managedNFTManager()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.v2PoolFactory()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.v3PoolFactory()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.v2GaugeFactory()).to.be.eq(TEST_ADDRESS);
          expect(await Voter.v3GaugeFactory()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.compoundEmissionExtension()).to.be.eq(ethers.ZeroAddress);
        });
        it('v3GaugeFactory', async () => {
          await expect(Voter.updateAddress('v3GaugeFactory', TEST_ADDRESS))
            .to.be.emit(Voter, 'UpdateAddress')
            .withArgs('v3GaugeFactory', TEST_ADDRESS);
          expect(await Voter.minter()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.bribeFactory()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.gaugeRewarder()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.veNestMerklAidrop()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.managedNFTManager()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.v2PoolFactory()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.v3PoolFactory()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.v2GaugeFactory()).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.v3GaugeFactory()).to.be.eq(TEST_ADDRESS);
          expect(await Voter.compoundEmissionExtension()).to.be.eq(ethers.ZeroAddress);
        });
      });
    });

    describe('#createV2Gauge', async () => {
      describe('fail if', async () => {
        it('user havent GOVERNANCE_ROLE role', async () => {
          await expect(Voter.connect(signers.otherUser1).createV2Gauge(signers.otherUser1.address)).to.be.revertedWith(
            getAccessControlError(ethers.id('GOVERNANCE_ROLE'), signers.otherUser1.address),
          );
        });
        it('gauge for pool already exists', async () => {
          let pair = await deployed.v2PairFactory.createPair.staticCall(deployed.fenix.target, token.target, false);
          await deployed.v2PairFactory.createPair(deployed.fenix.target, token.target, false);
          await Voter.createV2Gauge(pair);
          await expect(Voter.createV2Gauge(pair)).to.be.revertedWithCustomError(Voter, 'GaugeForPoolAlreadyExists');
        });
        it('invalid pool address', async () => {
          await expect(Voter.createV2Gauge(deployed.fenix.target)).to.be.revertedWithCustomError(Voter, 'PoolNotCreatedByFactory');
        });
      });

      describe('success create v2 gauge for v2 pool', async () => {
        let tx: any;
        let pair: any;
        let res: any;

        beforeEach(async () => {
          pair = await deployed.v2PairFactory.createPair.staticCall(deployed.fenix.target, token.target, false);
          await deployed.v2PairFactory.createPair(deployed.fenix.target, token.target, false);
          res = await Voter.createV2Gauge.staticCall(pair);
          tx = await Voter.createV2Gauge(pair);
        });

        it('return correct address', async () => {
          expect(await Voter.poolToGauge(pair)).to.be.eq(res.gauge);
          expect((await Voter.gaugesState(res.gauge)).pool).to.be.eq(pair);
        });

        it('isGauge & poolFoGauge should return correct state', async () => {
          expect(await Voter.isGauge(res.gauge)).to.be.true;
          expect(await Voter.poolForGauge(res.gauge)).to.be.eq(pair);
        });

        it('initialized gauge state', async () => {
          let gaugeState = await Voter.gaugesState(res.gauge);
          expect(gaugeState.isGauge).to.be.true;
          expect(gaugeState.isAlive).to.be.true;
          expect(gaugeState.internalBribe).to.be.not.eq(ethers.ZeroAddress);
          expect(gaugeState.externalBribe).to.be.not.eq(ethers.ZeroAddress);
          expect(gaugeState.internalBribe).to.be.eq(res.internalBribe);
          expect(gaugeState.externalBribe).to.be.eq(res.externalBribe);
          expect(gaugeState.pool).to.be.eq(pair);
          expect(gaugeState.claimable).to.be.eq(0);
          expect(gaugeState.index).to.be.eq(0);
          expect(gaugeState.lastDistributionTimestamp).to.be.eq(await Voter.epochTimestamp());
        });

        it('success emit event', async () => {
          await expect(tx)
            .to.be.emit(Voter, 'GaugeCreated')
            .withArgs(res.gauge, signers.deployer.address, res.internalBribe, res.externalBribe, pair);
        });

        it('add pool to v2 list', async () => {
          expect(await Voter.v2Pools(0)).to.be.eq(pair);
        });

        it('add pool to general list', async () => {
          expect(await Voter.pools(0)).to.be.eq(pair);
        });
      });
    });
    describe('#createV3Gauge', async () => {
      describe('fail if', async () => {
        it('user havent GOVERNANCE_ROLE role', async () => {
          await expect(Voter.connect(signers.otherUser1).createV3Gauge(signers.otherUser1.address)).to.be.revertedWith(
            getAccessControlError(ethers.id('GOVERNANCE_ROLE'), signers.otherUser1.address),
          );
        });
        it('gauge for pool already exists', async () => {
          let pair = await deployed.v2PairFactory.createPair.staticCall(deployed.fenix.target, token.target, false);
          await deployed.v2PairFactory.createPair(deployed.fenix.target, token.target, false);
          await Voter.createV2Gauge(pair);
          await expect(Voter.createV3Gauge(pair)).to.be.revertedWithCustomError(Voter, 'GaugeForPoolAlreadyExists');
        });

        it('pool was not created by v3 factory', async () => {
          await setupV3GaugeEnvironment();
          const pool = await ethers.deployContract('PoolMock');
          await pool.setTokens(deployed.fenix.target, token.target);

          await expect(Voter.createV3Gauge(pool.target)).to.be.revertedWithCustomError(Voter, 'PoolNotCreatedByFactory');
        });
      });

      describe('success create v3 gauge', async () => {
        it('classic algebra pool', async () => {
          const algebraCore = await setupV3GaugeEnvironment();
          const pool = await createClassicV3Pool(algebraCore, deployed.fenix.target as string, token.target as string);
          const poolAddress = await pool.getAddress();

          const res = await Voter.createV3Gauge.staticCall(poolAddress);
          const tx = await Voter.createV3Gauge(poolAddress);
          const gaugeState = await Voter.gaugesState(res.gauge);

          expect(await algebraCore.factory.deployerByPool(poolAddress)).to.be.eq(ethers.ZeroAddress);
          expect(await Voter.poolToGauge(poolAddress)).to.be.eq(res.gauge);
          expect(await Voter.isGauge(res.gauge)).to.be.true;
          expect(await Voter.poolForGauge(res.gauge)).to.be.eq(poolAddress);
          expect(gaugeState.isGauge).to.be.true;
          expect(gaugeState.isAlive).to.be.true;
          expect(gaugeState.internalBribe).to.be.eq(res.internalBribe);
          expect(gaugeState.externalBribe).to.be.eq(res.externalBribe);
          expect(gaugeState.pool).to.be.eq(poolAddress);
          expect(gaugeState.claimable).to.be.eq(0);
          expect(gaugeState.index).to.be.eq(0);
          expect(gaugeState.lastDistributionTimestamp).to.be.eq(await Voter.epochTimestamp());
          expect(await Voter.v3Pools(0)).to.be.eq(poolAddress);
          expect(await Voter.pools(0)).to.be.eq(poolAddress);

          const gauge = await ethers.getContractAt('GaugeUpgradeable', res.gauge);
          expect(await gauge.feeVault()).to.be.eq(await pool.communityVault());

          await expect(tx)
            .to.be.emit(Voter, 'GaugeCreated')
            .withArgs(res.gauge, signers.deployer.address, res.internalBribe, res.externalBribe, poolAddress);
          await expect(tx).to.be.emit(Voter, 'GaugeCreatedType').withArgs(res.gauge, 1);
        });

        it('custom algebra pool', async () => {
          const algebraCore = await setupV3GaugeEnvironment();
          const pluginFactory = await ethers.deployContract('AlgebraCustomPoolPluginFactoryMock');
          await algebraCore.factory.grantRole(await algebraCore.factory.CUSTOM_POOL_DEPLOYER(), pluginFactory.target);

          const poolAddress = await pluginFactory.createCustomPool.staticCall(
            algebraCore.factory.target,
            signers.deployer.address,
            deployed.fenix.target,
            token.target,
            '0x1234',
          );
          await pluginFactory.createCustomPool(algebraCore.factory.target, signers.deployer.address, deployed.fenix.target, token.target, '0x1234');

          const pool = await ethers.getContractAt(POOL_ABI, poolAddress);
          await pool.initialize(encodePriceSqrt(1, 1));

          const customDeployer = await algebraCore.factory.deployerByPool(poolAddress);
          expect(customDeployer).to.be.eq(pluginFactory.target);
          expect(await algebraCore.factory.customPoolByPair(customDeployer, deployed.fenix.target, token.target)).to.be.eq(poolAddress);

          const res = await Voter.createV3Gauge.staticCall(poolAddress);
          const tx = await Voter.createV3Gauge(poolAddress);

          expect(await Voter.poolToGauge(poolAddress)).to.be.eq(res.gauge);
          expect(await Voter.v3Pools(0)).to.be.eq(poolAddress);

          const gauge = await ethers.getContractAt('GaugeUpgradeable', res.gauge);
          expect(await gauge.feeVault()).to.be.eq(await pool.communityVault());

          await expect(tx)
            .to.be.emit(Voter, 'GaugeCreated')
            .withArgs(res.gauge, signers.deployer.address, res.internalBribe, res.externalBribe, poolAddress);
          await expect(tx).to.be.emit(Voter, 'GaugeCreatedType').withArgs(res.gauge, 1);
        });
      });
    });
  });
});
