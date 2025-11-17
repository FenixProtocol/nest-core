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
describe('MinterUpgradeable Clear Contract', function () {
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

  describe('Should eq to spreedsheet', async () => {
    function formatEpochDate(epochTs: bigint | number): string {
      const date = new Date(Number(epochTs) * 1000);

      const dd = String(date.getUTCDate()).padStart(2, '0');
      const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
      const yyyy = date.getUTCFullYear();

      return `${dd}/${mm}/${yyyy}`;
    }

    it(`check epoch from 0 to 18 basic on spreedsheet, with adjustment percentage`, async () => {
      expect(await fenix.totalSupply()).to.be.eq(INITIAL_TOKEN_SUPPLY);

      await minter.start();
      let emissions = [
      '0',
      '20000000.00',
      '20300000.00',
      '20604500.00',
      '21959245.88', // +5%
      '21227271.01',
      '21545680.08',
      '21868865.28',
      '22196898.26',
      '21403359.15', // -5%
      '22867799.51',
      '23210816.50',
      '23558978.75',
      '23323388.96',
      '24244662.82', // +5%
      '24002216.20', // +5%
      '21499127.94', // -5%
      '21284136.66', // -5%
      '22180310.83'
      ];
      const adjustmentsBps: number[] = [
        0,    // epoch 0
        0,    // 1
        0,    // 2
        0,    // 3
        500,  // 4  (+5%)
        0,    // 5
        0,    // 6
        0,    // 7
        0,    // 8
        -500, // 9  (-5%)
        0,    // 10
        0,    // 11
        0,    // 12
        0,    // 13
        500,  // 14 (+5%)
        500,  // 15 (+5%)
        -500, // 16 (-5%)
        -500, // 17 (-5%)
        0     // 18
      ];
      let lastTotalSupply: bigint = await fenix.totalSupply();
      let changeBefore: bigint = BigInt(0);

      for (let epoch  = 0; epoch  < emissions.length; epoch ++) {
        await minter.setEpochEmissionAdjustmentBps(adjustmentsBps[epoch]);

        lastTotalSupply = await fenix.totalSupply();
        await minter.update_period();
        const activePeriod = await minter.active_period();
        const dateStr = formatEpochDate(activePeriod);

        await time.increase(WEEK);
        let change = (await fenix.totalSupply()) - lastTotalSupply;
        console.log(
          `${epoch } ${dateStr} ` +
          `${ethers.formatEther(await fenix.totalSupply())} ` +
          `${ethers.formatEther(change)}`
        );        
        console.log(
          `${ethers.formatEther(await fenix.totalSupply())} `
        );   
        expect(change).to.be.closeTo(ethers.parseEther(emissions[epoch].toString()), ethers.parseEther('1'));
        changeBefore = change;
      }

      expect(await fenix.totalSupply()).to.be.closeTo(ethers.parseEther('1397277257.81'), ethers.parseEther('1'));
    });

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

});
