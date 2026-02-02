import { setCode, time } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { Nest, MinterUpgradeable, VoterEscrowMock, VoterMock } from '../../typechain-types/index';
import { ERRORS, ONE, ZERO, ZERO_ADDRESS } from '../utils/constants';
import { SignersList, deployFenixToken, deployMinter, getSigners } from '../utils/coreFixture';

/*
  #### Minter:
  Inflation Period Count: 12
  Inflation Rate: 150  // 1.5%
  Decay Rate: 100 // 1%
  Team Rate: 500 // 5%
  Start Emission: 20_000_000e18

  E1 Emissions: 20,000,000 (2% of initial supply) 
  Increase: +1.5% each epoch for 12 epochs (2-13) 
  Decay: -1% each epoch forever after that starting epoch 14
*/
describe('MinterUpgradeable Contract', function () {
  let minter: MinterUpgradeable;
  let signers: SignersList;
  let fenix: Nest;
  let voterMock: VoterMock;
  let voterEscrow: VoterEscrowMock;

  const WEEK: bigint = BigInt(86400 * 7);
  const INITIAL_TOKEN_SUPPLY = ethers.parseEther('1000000000');
  const WEEKLY = ethers.parseEther('20000000');

  async function currentPeriod(): Promise<bigint> {
    return (BigInt(await time.latest()) / WEEK) * WEEK;
  }

  beforeEach(async function () {
    signers = await getSigners();
    fenix = await deployFenixToken(signers.deployer, signers.deployer.address);
    voterMock = await ethers.deployContract('VoterMock');
    voterEscrow = await ethers.deployContract('VoterEscrowMock');

    await voterMock.setToken(fenix.target);
    await voterEscrow.setToken(fenix.target);

    minter = await deployMinter(
      signers.deployer,
      signers.proxyAdmin.address,

      await voterMock.getAddress(),
      await voterEscrow.getAddress(),
    );

    await fenix.transferOwnership(minter.target);
  });

  describe('Deployment', function () {
    it('Should set the right initial parameters', async () => {
      expect(await minter.isStarted()).to.be.false;
      expect(await minter.isFirstMint()).to.be.true;
      expect(await minter.nest()).to.be.eq(fenix.target);
      expect(await minter.ve()).to.be.eq(voterEscrow.target);
      expect(await minter.voter()).to.be.eq(voterMock.target);
      expect(await minter.inflationRate()).to.be.eq(150);
      expect(await minter.inflationRate()).to.be.eq(150);
      expect(await minter.decayRate()).to.be.eq(100);
      expect(await minter.teamRate()).to.be.eq(500);
      expect(await minter.MAX_TEAM_RATE()).to.be.eq(500);
      expect(await minter.weekly()).to.be.eq(ethers.parseEther('20000000'));
      expect(await minter.lastInflationPeriod()).to.be.eq(ZERO);
      expect(await minter.TAIL_EMISSION()).to.be.eq(20);
      expect(await minter.epochEmissionAdjustmentBps()).to.be.eq(0);
    });
    it('Should set avtive_period in two weeks', async () => {
      let inTwoPeriod = ((BigInt(await time.latest()) + BigInt(2) * WEEK) / WEEK) * WEEK;
      expect(await minter.active_period()).to.be.eq(inTwoPeriod);
    });
    it('Should set deployed like owner', async () => {
      expect(await minter.owner()).to.be.eq(signers.deployer);
    });
    it('Minter should be owner of Fenix token', async () => {
      expect(await fenix.owner()).to.be.eq(minter.target);
    });
    it('Should fail if try call initialize second time', async () => {
      await expect(minter.initialize(ZERO_ADDRESS, ZERO_ADDRESS, 0)).to.be.revertedWith(ERRORS.Initializable.Initialized);
    });
  });

  describe('Only ownable functions', async () => {
    describe('#start', async () => {
      it('Should fail if caller not owner', async () => {
        await expect(minter.connect(signers.otherUser1).start()).to.be.revertedWith(ERRORS.Ownable.NotOwner);
      });
      it('Should fail if try call second time', async () => {
        await minter.start();
        await expect(minter.start()).to.be.revertedWith('Already started');
      });
      it('Should corect start, and calc params', async () => {
        let inTwoPeriod = ((BigInt(await time.latest()) + BigInt(2) * WEEK) / WEEK) * WEEK;

        expect(await minter.isStarted()).to.be.false;
        expect(await minter.active_period()).to.be.eq(inTwoPeriod);
        expect(await minter.lastInflationPeriod()).to.be.eq(ZERO);

        await minter.start();

        let cp = await currentPeriod();
        expect(await minter.isStarted()).to.be.true;
        expect(await minter.active_period()).to.be.eq(cp);
        expect(await minter.lastInflationPeriod()).to.be.eq(cp + WEEK * BigInt(12));
      });
    });
    describe('#voter', async () => {
      it('Should fail if caller not owner', async () => {
        await expect(minter.connect(signers.otherUser1).setVoter(signers.otherUser1.address)).to.be.revertedWith(ERRORS.Ownable.NotOwner);
      });
      it('Should fail if provide zero address', async () => {
        await expect(minter.setVoter(ZERO_ADDRESS)).to.be.reverted;
      });
      it('Should success change voter', async () => {
        expect(await minter.voter()).to.be.eq(voterMock.target);
        await minter.setVoter(signers.otherUser1.address);
        expect(await minter.voter()).to.be.eq(signers.otherUser1.address);
      });
    });
    describe('#setTeamRate', async () => {
      it('Should fail if caller not owner', async () => {
        await expect(minter.connect(signers.otherUser1).setTeamRate(100)).to.be.revertedWith(ERRORS.Ownable.NotOwner);
      });
      it('Should fail if try set more > 5%', async () => {
        await minter.setTeamRate(499);
        await minter.setTeamRate(500);
        await expect(minter.setTeamRate(501)).to.be.revertedWith('rate too high');
        await expect(minter.setTeamRate(502)).to.be.revertedWith('rate too high');
      });
      it('Should success change team rate', async () => {
        expect(await minter.teamRate()).to.be.eq(500);
        await minter.setTeamRate(422);
        expect(await minter.teamRate()).to.be.eq(422);
      });
    });
    describe('#setDecayRate', async function () {
      it('Should fail if caller not owner', async () => {
        await expect(minter.connect(signers.otherUser1).setDecayRate(100)).to.be.revertedWith(ERRORS.Ownable.NotOwner);
      });
      it('Should fail if try set more > 100%', async () => {
        await minter.setDecayRate(9999);
        await minter.setDecayRate(10000);
        await expect(minter.setDecayRate(10001)).to.be.revertedWith('rate too high');
        await expect(minter.setDecayRate(10002)).to.be.revertedWith('rate too high');
      });
      it('Should success change decay rate', async () => {
        expect(await minter.decayRate()).to.be.eq(100);
        await minter.setDecayRate(506);
        expect(await minter.decayRate()).to.be.eq(506);
      });
    });
    describe('#setInflationRate', async () => {
      it('Should fail if caller not owner', async () => {
        await expect(minter.connect(signers.otherUser1).setInflationRate(100)).to.be.revertedWith(ERRORS.Ownable.NotOwner);
      });
      it('Should fail if try set more > 100%', async () => {
        await minter.setInflationRate(9999);
        await minter.setInflationRate(10000);
        await expect(minter.setInflationRate(10001)).to.be.revertedWith('rate too high');
        await expect(minter.setInflationRate(10002)).to.be.revertedWith('rate too high');
      });
      it('Should success change decay rate', async () => {
        expect(await minter.inflationRate()).to.be.eq(150);
        await minter.setInflationRate(506);
        expect(await minter.inflationRate()).to.be.eq(506);
      });
    });
    describe('#setEpochEmissionAdjustmentBps', async function () {
      it('Should fail if caller not owner', async () => {
        await expect(minter.connect(signers.otherUser1).setEpochEmissionAdjustmentBps(100)).to.be.revertedWith(ERRORS.Ownable.NotOwner);
        await expect(minter.connect(signers.otherUser1).setEpochEmissionAdjustmentBps(-100)).to.be.revertedWith(ERRORS.Ownable.NotOwner);
      });
      it('Should fail if try set more > 10% or less 10%', async () => {
        await minter.setEpochEmissionAdjustmentBps(2500);
        await minter.setEpochEmissionAdjustmentBps(0);
        await minter.setEpochEmissionAdjustmentBps(-2500);
        await expect(minter.setEpochEmissionAdjustmentBps(2501)).to.be.revertedWith('adjustment bps out of range');
        await expect(minter.setEpochEmissionAdjustmentBps(-2501)).to.be.revertedWith('adjustment bps out of range');
      });

      it('Should success set epoch emission adjustment bps', async () => {
        expect(await minter.epochEmissionAdjustmentBps()).to.be.eq(0);
        await expect(minter.setEpochEmissionAdjustmentBps(-123)).to.be.emit(minter, "SetEpochEmissionAdjustmentBps").withArgs(-123);
        expect(await minter.epochEmissionAdjustmentBps()).to.be.eq(-123);

        await expect(minter.setEpochEmissionAdjustmentBps(456)).to.be.emit(minter, "SetEpochEmissionAdjustmentBps").withArgs(456);
        expect(await minter.epochEmissionAdjustmentBps()).to.be.eq(456);

        await expect(minter.setEpochEmissionAdjustmentBps(0)).to.be.emit(minter, "SetEpochEmissionAdjustmentBps").withArgs(0);
        expect(await minter.epochEmissionAdjustmentBps()).to.be.eq(0);

      });
    });
  });

  describe('#check', async () => {
    it('Should return false if not launch start`', async () => {
      expect(await minter.check()).to.be.false;
    });
    it('Should return false if launch but is not new period`', async () => {
      await minter.start();
      expect(await minter.check()).to.be.false;
    });
    it('Should return true if new period, and false after update to new period`', async () => {
      await minter.start();
      await time.increase(WEEK);
      expect(await minter.check()).to.be.true;
      await minter.update_period();
      expect(await minter.check()).to.be.false;
    });
  });
  describe('#period', async () => {
    it('Should corectly calculate current `period`', async () => {
      expect(await minter.period()).to.be.eq(await currentPeriod());
    });
  });
  describe('#circulating_supply', async () => {
    it('Should corectly calculate circulation supply', async () => {
      let beforeCS = await minter.circulating_supply();
      expect(beforeCS).to.be.eq(await fenix.totalSupply());

      await fenix.transfer(voterEscrow.target, 1);

      let afterCS = await minter.circulating_supply();

      expect(afterCS).to.be.eq((await fenix.totalSupply()) - ONE);
      expect(beforeCS - afterCS).to.be.eq(ONE);

      await fenix.transfer(voterEscrow.target, await fenix.balanceOf(signers.deployer));

      expect(await minter.circulating_supply()).to.be.eq(ZERO);
    });
  });
  it('Should not mint any tokens if wasnt call start', async () => {
    expect(await fenix.totalSupply()).to.be.eq(INITIAL_TOKEN_SUPPLY);
    await time.increase(WEEK);
    await minter.update_period();
    await time.increase(WEEK);
    await minter.update_period();
    expect(await fenix.totalSupply()).to.be.eq(INITIAL_TOKEN_SUPPLY);
  });
  describe('#update_period', async () => {
    beforeEach(async () => {
      await minter.start();
    });

    it('Should not distribute emission and emit event ', async () => {
      expect(await fenix.balanceOf(minter.target)).to.be.eq(ZERO);
      expect(await fenix.balanceOf(voterMock.target)).to.be.eq(ZERO);
      expect(await fenix.balanceOf(signers.deployer)).to.be.eq(INITIAL_TOKEN_SUPPLY);

      await time.increase(WEEK);
      let toTeam = ((await minter.weekly()) * BigInt(500)) / BigInt(10000);
      await expect(minter.connect(signers.otherUser1).update_period())
        .to.be.emit(minter, 'Mint')
        .withArgs(signers.otherUser1.address, WEEKLY, INITIAL_TOKEN_SUPPLY + WEEKLY);

      expect(await fenix.balanceOf(voterMock.target)).to.be.eq(WEEKLY - toTeam);
      expect(await fenix.balanceOf(signers.deployer)).to.be.eq(INITIAL_TOKEN_SUPPLY + toTeam);
      expect(await fenix.balanceOf(minter.target)).to.be.eq(ZERO);
    });
    it('Should not update after start and change balance or mint ', async () => {
      let tsBefore = await fenix.totalSupply();
      let periodBefore = await minter.active_period();

      expect(await fenix.balanceOf(minter.target)).to.be.eq(ZERO);
      expect(await fenix.balanceOf(voterMock.target)).to.be.eq(ZERO);

      await minter.update_period();
      expect(await fenix.balanceOf(voterMock.target)).to.be.eq(ZERO);

      expect(await fenix.balanceOf(minter.target)).to.be.eq(ZERO);

      expect(await minter.active_period()).to.be.eq(periodBefore);
      expect(await fenix.totalSupply()).to.be.eq(tsBefore);
    });

    it('Should corect mint first value without any decay or inflation but eq weekly amount ', async () => {
      let tsBefore = await fenix.totalSupply();
      let periodBefore = await minter.active_period();
      let balanceOwnerBefore = await fenix.balanceOf(signers.deployer);

      await time.increase(WEEK);

      expect(balanceOwnerBefore).to.be.eq(INITIAL_TOKEN_SUPPLY);
      expect(await fenix.balanceOf(minter.target)).to.be.eq(ZERO);
      expect(await fenix.balanceOf(voterMock.target)).to.be.eq(ZERO);
      expect(await minter.weekly()).to.be.eq(WEEKLY);

      await minter.update_period();

      expect(await minter.weekly()).to.be.eq(WEEKLY);
      expect(await fenix.balanceOf(voterMock.target)).to.be.eq(WEEKLY - ethers.parseEther('1000000'));
      expect(await fenix.balanceOf(minter.target)).to.be.eq(ZERO);
      expect(await fenix.balanceOf(signers.deployer)).to.be.eq(balanceOwnerBefore + ethers.parseEther('1000000')); // 5% from WEEKLY

      expect(await minter.active_period()).to.be.eq(periodBefore + WEEK);

      expect(await fenix.totalSupply()).to.be.eq(tsBefore + WEEKLY);
    });
    it('Should corect mint value for inflation epoch with increasing WEEKLY amount ', async () => {
      const INFLATION_RATE = BigInt(150); // 1.5%

      let weeklyBefore = await minter.weekly();

      expect(weeklyBefore).to.be.eq(WEEKLY);

      await time.increase(WEEK);
      await minter.update_period();

      expect(await minter.weekly()).to.be.eq(WEEKLY);
      // skipp all inflation periods
      while ((await minter.period()) < (await minter.lastInflationPeriod())) {
        await time.increase(WEEK);
        await minter.update_period();
        let newWeekly = await minter.weekly();
        expect(newWeekly - weeklyBefore).to.be.eq((INFLATION_RATE * weeklyBefore) / BigInt(10000));
        expect(newWeekly).to.be.greaterThan(weeklyBefore);
        weeklyBefore = newWeekly;
      }

      // stop after end inflation epoch, start decrease
      await time.increase(WEEK);
      await minter.update_period();

      expect(await minter.weekly()).to.be.lessThan(weeklyBefore);
    });
    it('Should corect mint value for decay epoch with decreasyng WEEKLY amount ', async () => {
      let weeklyBefore = await minter.weekly();

      expect(weeklyBefore).to.be.eq(WEEKLY);

      await time.increase(WEEK);
      await minter.update_period();

      expect(await minter.weekly()).to.be.eq(WEEKLY);

      while ((await minter.period()) < (await minter.lastInflationPeriod())) {
        await time.increase(WEEK);
        await minter.update_period();
        let newWeekly = await minter.weekly();
        expect(newWeekly).to.be.greaterThan(weeklyBefore);
        weeklyBefore = newWeekly;
      }
      // stop after end inflation epoch, start decrease
      await time.increase(WEEK);
      await minter.update_period();

      expect(await minter.weekly()).to.be.lessThan(weeklyBefore);
      weeklyBefore = await minter.weekly();

      for (let index = 0; index < 20; index++) {
        await time.increase(WEEK);
        await minter.update_period();
        let newWeekly = await minter.weekly();
        expect(newWeekly).to.be.lessThan(weeklyBefore);
        expect(weeklyBefore - newWeekly).to.be.eq((BigInt(100) * weeklyBefore) / BigInt(10000));
        weeklyBefore = newWeekly;
      }
    });
    it('Should corect work after change inflation rate beetwen epoch', async () => {
      await time.increase(WEEK);
      await minter.update_period();
      expect(await minter.weekly()).to.be.eq(ethers.parseEther('20000000'));

      await time.increase(WEEK);
      await minter.update_period();

      expect(await minter.weekly()).to.be.eq(ethers.parseEther('20300000'));

      await time.increase(WEEK);
      await minter.update_period();

      expect(await minter.weekly()).to.be.closeTo(ethers.parseEther('20604500'), ethers.parseEther('1'));

      await minter.setInflationRate(200); // from 1.5% to 2%

      await time.increase(WEEK);
      await minter.update_period();
      expect(await minter.weekly()).to.be.closeTo(ethers.parseEther('21016590'), ethers.parseEther('1'));

      await time.increase(WEEK);
      await minter.update_period();
      expect(await minter.weekly()).to.be.closeTo(ethers.parseEther('21436921.8'), ethers.parseEther('1'));
    });

    it('Clear spreedshet test', async () => {
      console.log(await fenix.totalSupply());
      await minter.update_period();
      console.log(await fenix.totalSupply());
      let before = await fenix.totalSupply();
      for (let index = 0; index < 30; index++) {
        await time.increase(WEEK);
        await minter.update_period();
        let after = await fenix.totalSupply();
        console.log(await fenix.totalSupply(), ethers.formatEther(after - before));
        before = after;
      }
    });

    it('Should corect work after change decay rate beetwen epoch', async () => {
      while ((await minter.period()) <= (await minter.lastInflationPeriod())) {
        await time.increase(WEEK);
        await minter.update_period();
        console.log(await fenix.totalSupply());
      }
      expect(await minter.weekly()).to.be.closeTo(ethers.parseEther('23323388.96'), ethers.parseEther('1'));
      await time.increase(WEEK);
      await minter.update_period();
      expect(await minter.weekly()).to.be.closeTo(ethers.parseEther('23090155.07'), ethers.parseEther('1'));
      await minter.setDecayRate(321); // from 1% to 3.21%
      await time.increase(WEEK);
      await minter.update_period();
      expect(await minter.weekly()).to.be.closeTo(ethers.parseEther('22348961.1'), ethers.parseEther('1'));
      await time.increase(WEEK);
      await minter.update_period();
      expect(await minter.weekly()).to.be.closeTo(ethers.parseEther('21631559.4'), ethers.parseEther('1'));
    });
  });

  describe('Emission adjustments', async () => {
    describe('after start', async () => {
      beforeEach(async () => {
        await minter.start();
      });

      it('Should apply positive boost for the upcoming epoch and emit details', async () => {
        const boost = BigInt(500);
        await minter.setEpochEmissionAdjustmentBps(boost);

        const baseWeekly = await minter.weekly();
        const ownerBalanceBefore = await fenix.balanceOf(signers.deployer.address);
        const voterBalanceBefore = await fenix.balanceOf(voterMock.target);

        await time.increase(WEEK);
        const epoch = await minter.period();
        const adjustedWeekly = (baseWeekly * (BigInt(10000) + boost)) / BigInt(10000);
        const teamRate = await minter.teamRate();
        const expectedTeam = (adjustedWeekly * teamRate) / BigInt(10000);
        const expectedGauge = adjustedWeekly - expectedTeam;

        await expect(minter.update_period())
          .to.emit(minter, 'Emission')
          .withArgs(epoch, boost, baseWeekly, adjustedWeekly, expectedTeam, expectedGauge);

        expect(await fenix.balanceOf(signers.deployer.address)).to.be.eq(ownerBalanceBefore + expectedTeam);
        expect(await fenix.balanceOf(voterMock.target)).to.be.eq(voterBalanceBefore + expectedGauge);
        expect(await minter.epochEmissionAdjustmentBps()).to.be.eq(ZERO);
      });

      it('Should apply negative adjustment and reset after execution', async () => {
        const boost = BigInt(-500);
        await minter.setEpochEmissionAdjustmentBps(boost);

        const baseWeekly = await minter.weekly();
        await time.increase(WEEK);
        const epoch = await minter.period();
        const adjustedWeekly = (baseWeekly * (BigInt(10000) + boost)) / BigInt(10000);
        const teamRate = await minter.teamRate();
        const expectedTeam = (adjustedWeekly * teamRate) / BigInt(10000);
        const expectedGauge = adjustedWeekly - expectedTeam;

        await expect(minter.update_period())
          .to.emit(minter, 'Emission')
          .withArgs(epoch, boost, baseWeekly, adjustedWeekly, expectedTeam, expectedGauge);

        expect(await minter.epochEmissionAdjustmentBps()).to.be.eq(ZERO);
        expect(await fenix.balanceOf(voterMock.target)).to.be.eq(expectedGauge);
        expect(await fenix.balanceOf(signers.deployer.address)).to.be.eq(INITIAL_TOKEN_SUPPLY + expectedTeam);
      });
    });
    describe('calculateEmissionWithAdjustment', () => {
      const PRECISION = 10_000n;

      it('returns same amount when adjustmentBps is 0', async () => {
        const amount = ethers.parseEther('100');

        const result = await minter.calculateEmissionWithAdjustment(amount, 0);

        expect(result).to.equal(amount);
        expect(result).to.equal(ethers.parseEther('100'));

      });

      it('applies positive adjustment (e.g. +5%) correctly', async () => {
        const amount = ethers.parseEther('100');
        const adjustmentBps = 500; // +5%

        const result = await minter.calculateEmissionWithAdjustment(amount, adjustmentBps);

        const expected =
          (amount * (PRECISION + BigInt(adjustmentBps))) / PRECISION; // 100 * 1.05

        expect(result).to.equal(expected);
        expect(result).to.equal(ethers.parseEther('105'));

      });

      it('applies negative adjustment (e.g. -5%) correctly', async () => {
        const amount = ethers.parseEther('100');
        const adjustmentBps = -500; // -5%

        const result = await minter.calculateEmissionWithAdjustment(amount, adjustmentBps);

        const expected =
          (amount * (PRECISION + BigInt(adjustmentBps))) / PRECISION; // 100 * 0.95

        expect(result).to.equal(expected);
        expect(result).to.equal(ethers.parseEther('95'));
      });

      it('never returns negative emission; clamps to 0 if adjusted < 0', async () => {
        const amount = ethers.parseEther('1');
        const adjustmentBps = -20_000;

        const result = await minter.calculateEmissionWithAdjustment(amount, adjustmentBps);

        expect(result).to.equal(0n);
        expect(result).to.equal(0n);
      });

      it('handles large amounts without overflow and with correct math', async () => {
        const amount = ethers.parseEther('1000000000');
        const adjustmentBps = 250;

        const result = await minter.calculateEmissionWithAdjustment(amount, adjustmentBps);

        const expected =
          (amount * (PRECISION + BigInt(adjustmentBps))) / PRECISION;

        expect(result).to.equal(expected);
        expect(result).to.equal(ethers.parseEther('1025000000'));
      });
    });
  });

  describe('Should eq to spreedsheet', async () => {
    function formatEpochDate(epochTs: bigint | number): string {
      const date = new Date(Number(epochTs) * 1000);

      const dd = String(date.getUTCDate()).padStart(2, '0');
      const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
      const yyyy = date.getUTCFullYear();

      return `${dd}/${mm}/${yyyy}`;
    }

    it(`check epoch from 0 to 18 basic on spreedsheet`, async () => {
      expect(await fenix.totalSupply()).to.be.eq(INITIAL_TOKEN_SUPPLY);

      await minter.start();
      let emissions = [
        0,
        20000000.00,
        20300000.00,
        20604500.00,
        20913567.50,
        21227271.01,
        21545680.08,
        21868865.28,
        22196898.26,
        22529851.73,
        22867799.51,
        23210816.50,
        23558978.75,
        23323388.96,
        23090155.07,
        22859253.52,
        22630660.99,
        22404354.38,
        22180310.83
      ];
      let lastTotalSupply: bigint = await fenix.totalSupply();
      let changeBefore: bigint = BigInt(0);

      for (let index = 0; index < emissions.length; index++) {
        lastTotalSupply = await fenix.totalSupply();
        await minter.update_period();
        const activePeriod = await minter.active_period();
        const dateStr = formatEpochDate(activePeriod);

        await time.increase(WEEK);
        let change = (await fenix.totalSupply()) - lastTotalSupply;
        console.log(
          `${index} ${dateStr} ` +
          `${ethers.formatEther(await fenix.totalSupply())} ` +
          `${ethers.formatEther(change)}`
        );
        expect(change).to.be.closeTo(ethers.parseEther(emissions[index].toString()), ethers.parseEther('1'));
        changeBefore = change;
      }

      expect(await fenix.totalSupply()).to.be.closeTo(ethers.parseEther('1397312352.36'), ethers.parseEther('1'));
    });
  });

  describe('TAIL_EMISSION', async () => {
    it('Should corect calculate circulating_emission()', async () => {
      // when circulation supply = totalSuply()
      let supply = await fenix.totalSupply();
      expect(supply).to.be.eq(await minter.circulating_supply());
      expect(await minter.circulating_emission()).to.be.eq((supply * BigInt(20)) / BigInt(10000));

      await fenix.transfer(voterEscrow.target, supply / BigInt(2));

      expect(await minter.circulating_supply()).to.be.eq(supply / BigInt(2));
      expect(await minter.circulating_emission()).to.be.closeTo(((supply / BigInt(2)) * BigInt(20)) / BigInt(10000), ONE);
    });
    it('Should corect calculate weekly_emission() when emission is less than circulation_emisison()', async () => {
      // lock 60% fnx on veFNX
      await fenix.transfer(voterEscrow.target, ((await fenix.totalSupply()) * BigInt(60)) / BigInt(100));
      await minter.start();
      for (let i = 0; i < 300; i++) {
        await time.increase(WEEK);
        await minter.update_period();
        // should be never less then 0.2% from circlation supply
        let circulation = await minter.circulating_supply();
        let minEmission = (circulation * BigInt(20)) / BigInt(10000);
        expect(await minter.weekly_emission()).to.be.greaterThanOrEqual(minEmission);
      }
    });
  });
});
