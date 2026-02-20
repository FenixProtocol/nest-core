import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { ERC20Mock, FeesVaultFactoryUpgradeable, FeesVaultUpgradeable, Pair, PairFactoryUpgradeable, PairFactoryUpgradeable__factory } from '../../typechain-types';
import { ONE_ETHER, ZERO } from '../utils/constants';
import completeFixture, { CoreFixtureDeployed, SignersList, deployERC20MockToken } from '../utils/coreFixture';

const PRECISION = BigInt(10000);
describe('Pair Contract', function () {
  let signers: SignersList;
  let pairFactoryFactory: PairFactoryUpgradeable__factory;
  let pairFactory: PairFactoryUpgradeable;
  let feesVaultFactory: FeesVaultFactoryUpgradeable;
  let deployed: CoreFixtureDeployed;
  let tokenTK18: ERC20Mock;
  let tokenTK6: ERC20Mock;
  let pairStable: Pair;
  let pairVolatily: Pair;

  beforeEach(async function () {
    deployed = await loadFixture(completeFixture);
    signers = deployed.signers;

    pairFactoryFactory = await ethers.getContractFactory('PairFactoryUpgradeable');
    pairFactory = deployed.v2PairFactory;
    feesVaultFactory = deployed.feesVaultFactory;

    tokenTK18 = await deployERC20MockToken(deployed.signers.deployer, 'TK18', 'TK18', 18);
    tokenTK6 = await deployERC20MockToken(deployed.signers.deployer, 'TK6', 'TK6', 6);

    await feesVaultFactory.grantRole(await feesVaultFactory.WHITELISTED_CREATOR_ROLE(), pairFactory.target);

    await deployed.v2PairFactory.connect(signers.deployer).createPair(deployed.fenix.target, tokenTK6.target, true);
    await deployed.v2PairFactory.connect(signers.deployer).createPair(tokenTK18.target, tokenTK6.target, false);
    pairStable = await ethers.getContractAt('Pair', await pairFactory.getPair(deployed.fenix.target, tokenTK6.target, true));
    pairVolatily = await ethers.getContractAt('Pair', await pairFactory.getPair(tokenTK18.target, tokenTK6.target, false));
  });

  describe('deployments', async () => {
    it('fail if try initialzie second time', async () => {
      await expect(pairVolatily.initialize(tokenTK18.target, tokenTK6.target, true, signers.otherUser1.address)).to.be.revertedWith(
        'Initialized',
      );
    });
    it('corect initialize start parameters', async () => {
      expect(await pairVolatily.factory()).to.be.eq(pairFactory.target);

      if (tokenTK18.target.toString().toLowerCase() < tokenTK6.target.toString().toLowerCase()) {
        expect(await pairVolatily.name()).to.be.eq('VolatileV1 AMM - TK18/TK6');
        expect(await pairVolatily.symbol()).to.be.eq('vAMM-TK18/TK6');
      } else {
        expect(await pairVolatily.name()).to.be.eq('VolatileV1 AMM - TK6/TK18');
        expect(await pairVolatily.symbol()).to.be.eq('vAMM-TK6/TK18');
      }

      expect(await pairStable.factory()).to.be.eq(pairFactory.target);

      if (deployed.fenix.target.toString().toLowerCase() < tokenTK6.target.toString().toLowerCase()) {
        expect(await pairStable.name()).to.be.eq('StableV1 AMM - NEST/TK6');
        expect(await pairStable.symbol()).to.be.eq('sAMM-NEST/TK6');
      } else {
        expect(await pairStable.name()).to.be.eq('StableV1 AMM - TK6/NEST');
        expect(await pairStable.symbol()).to.be.eq('sAMM-TK6/NEST');
      }
    });
  });
  describe('swaps fees corect calculate and transfer to feesVault for volatility pairs', async () => {
    it('case protocol fee 0, volatility pair, volatility fee 0.1%', async () => {
      await pairFactory.setFee(false, 10);
      await pairFactory.setProtocolFee(0);

      expect(await tokenTK18.balanceOf(await pairVolatily.communityVault())).to.be.eq(ZERO);

      await tokenTK18.mint(pairVolatily.target, ONE_ETHER);

      await tokenTK6.mint(pairVolatily.target, 1e6);

      await pairVolatily.mint(signers.deployer.address);

      if ((await pairVolatily.token0()) == tokenTK18.target) {
        await tokenTK18.mint(pairVolatily.target, ethers.parseEther('0.12'));

        await pairVolatily.swap(0, 1e5, signers.deployer.address, '0x');

        let calcFee = (ethers.parseEther('0.12') * BigInt(10)) / PRECISION;
        let calcIndex = (calcFee * ethers.parseEther('1')) / (await pairVolatily.totalSupply());

        expect(await pairVolatily.index0()).to.be.eq(calcIndex);

        expect(await tokenTK18.balanceOf(await pairVolatily.fees())).to.be.eq(calcFee);

        expect(await tokenTK18.balanceOf(await pairVolatily.communityVault())).to.be.eq(ZERO);
      } else {
        await tokenTK18.mint(pairVolatily.target, ethers.parseEther('0.12'));

        await pairVolatily.swap(1e5, 0, signers.deployer.address, '0x');

        let calcFee = (ethers.parseEther('0.12') * BigInt(10)) / PRECISION;
        let calcIndex = (calcFee * ethers.parseEther('1')) / (await pairVolatily.totalSupply());

        expect(await pairVolatily.index1()).to.be.eq(calcIndex);

        expect(await tokenTK18.balanceOf(await pairVolatily.fees())).to.be.eq(calcFee);

        expect(await tokenTK18.balanceOf(await pairVolatily.communityVault())).to.be.eq(ZERO);
      }
    });
    it('case protocol fee 100%, volatility pair, custom fee 5% (MAX_FEE)', async () => {
      await pairFactory.setCustomFee(pairVolatily.target, 500);
      await pairFactory.setCustomProtocolFee(pairVolatily.target, PRECISION);

      expect(await tokenTK18.balanceOf(await pairVolatily.communityVault())).to.be.eq(ZERO);

      await tokenTK18.mint(pairVolatily.target, ONE_ETHER);

      await tokenTK6.mint(pairVolatily.target, 1e6);

      await pairVolatily.mint(signers.deployer.address);

      if ((await pairVolatily.token0()) == tokenTK18.target) {
        await tokenTK18.mint(pairVolatily.target, ethers.parseEther('0.12'));

        await pairVolatily.swap(0, 1e5, signers.deployer.address, '0x');

        let calcFee = (ethers.parseEther('0.12') * BigInt(500)) / PRECISION;

        expect(await pairVolatily.index0()).to.be.eq(ZERO);

        expect(await tokenTK18.balanceOf(await pairVolatily.fees())).to.be.eq(ZERO);

        expect(await tokenTK18.balanceOf(await pairVolatily.communityVault())).to.be.eq(calcFee);
      } else {
        await tokenTK18.mint(pairVolatily.target, ethers.parseEther('0.12'));

        await pairVolatily.swap(1e5, 0, signers.deployer.address, '0x');

        let calcFee = (ethers.parseEther('0.12') * BigInt(500)) / PRECISION;

        expect(await pairVolatily.index1()).to.be.eq(ZERO);

        expect(await tokenTK18.balanceOf(await pairVolatily.fees())).to.be.eq(ZERO);

        expect(await tokenTK18.balanceOf(await pairVolatily.communityVault())).to.be.eq(calcFee);
      }
    });
    it('case protocol fee 80%, volatility pair, custom fee 0.8%', async () => {
      await pairFactory.setCustomFee(pairVolatily.target, 80);
      await pairFactory.setCustomProtocolFee(pairVolatily.target, 8000);

      expect(await tokenTK18.balanceOf(await pairVolatily.communityVault())).to.be.eq(ZERO);

      await tokenTK18.mint(pairVolatily.target, ONE_ETHER);

      await tokenTK6.mint(pairVolatily.target, 1e6);

      await pairVolatily.mint(signers.deployer.address);

      if ((await pairVolatily.token0()) == tokenTK18.target) {
        await tokenTK18.mint(pairVolatily.target, ethers.parseEther('0.12'));

        await pairVolatily.swap(0, 1e5, signers.deployer.address, '0x');

        let calcFee = (ethers.parseEther('0.12') * BigInt(80)) / PRECISION;

        let calcFeeToFees = (calcFee * BigInt(2000)) / PRECISION;

        calcFee = calcFee - calcFeeToFees;

        let calcIndex = (calcFeeToFees * ethers.parseEther('1')) / (await pairVolatily.totalSupply());

        expect(await pairVolatily.index0()).to.be.eq(calcIndex);

        expect(await tokenTK18.balanceOf(await pairVolatily.fees())).to.be.eq(calcFeeToFees);

        expect(await tokenTK18.balanceOf(await pairVolatily.communityVault())).to.be.eq(calcFee);
      } else {
        await tokenTK18.mint(pairVolatily.target, ethers.parseEther('0.12'));

        await pairVolatily.swap(1e5, 0, signers.deployer.address, '0x');

        let calcFee = (ethers.parseEther('0.12') * BigInt(80)) / PRECISION;

        let calcFeeToFees = (calcFee * BigInt(2000)) / PRECISION;

        calcFee = calcFee - calcFeeToFees;

        let calcIndex = (calcFeeToFees * ethers.parseEther('1')) / (await pairVolatily.totalSupply());

        expect(await pairVolatily.index1()).to.be.eq(calcIndex);

        expect(await tokenTK18.balanceOf(await pairVolatily.fees())).to.be.eq(calcFeeToFees);

        expect(await tokenTK18.balanceOf(await pairVolatily.communityVault())).to.be.eq(calcFee);
      }
    });
    it('reverse case protocol fee 0, volatility pair, volatility fee 0.1%', async () => {
      await pairFactory.setFee(false, 10);
      await pairFactory.setProtocolFee(0);

      expect(await tokenTK6.balanceOf(await pairVolatily.communityVault())).to.be.eq(ZERO);

      await tokenTK18.mint(pairVolatily.target, ONE_ETHER);

      await tokenTK6.mint(pairVolatily.target, 1e6);

      await pairVolatily.mint(signers.deployer.address);

      if ((await pairVolatily.token0()) == tokenTK6.target) {
        await tokenTK6.mint(pairVolatily.target, 1.2e5);

        await pairVolatily.swap(0, ethers.parseEther('0.1'), signers.deployer.address, '0x');

        let calcFee = (BigInt(1.2e5) * BigInt(10)) / PRECISION;
        let calcIndex = (calcFee * ethers.parseEther('1')) / (await pairVolatily.totalSupply());

        expect(await pairVolatily.index0()).to.be.eq(calcIndex);

        expect(await tokenTK6.balanceOf(await pairVolatily.fees())).to.be.eq(calcFee);

        expect(await tokenTK6.balanceOf(await pairVolatily.communityVault())).to.be.eq(ZERO);
      } else {
        await tokenTK6.mint(pairVolatily.target, 1.2e5);

        await pairVolatily.swap(1e5, 0, signers.deployer.address, '0x');

        let calcFee = (BigInt(1.2e5) * BigInt(10)) / PRECISION;
        let calcIndex = (calcFee * ethers.parseEther('1')) / (await pairVolatily.totalSupply());

        expect(await pairVolatily.index1()).to.be.eq(calcIndex);

        expect(await tokenTK6.balanceOf(await pairVolatily.fees())).to.be.eq(calcFee);

        expect(await tokenTK6.balanceOf(await pairVolatily.communityVault())).to.be.eq(ZERO);
      }
    });
    it('reverse case protocol fee 100%, volatility pair, custom fee 5% (MAX_FEE)', async () => {
      await pairFactory.setCustomFee(pairVolatily.target, 500);
      await pairFactory.setCustomProtocolFee(pairVolatily.target, PRECISION);

      expect(await tokenTK18.balanceOf(await pairVolatily.communityVault())).to.be.eq(ZERO);

      await tokenTK18.mint(pairVolatily.target, ONE_ETHER);

      await tokenTK6.mint(pairVolatily.target, 1e6);

      await pairVolatily.mint(signers.deployer.address);

      if ((await pairVolatily.token0()) == tokenTK6.target) {
        await tokenTK6.mint(pairVolatily.target, BigInt(1.2e5));

        await pairVolatily.swap(0, 1e5, signers.deployer.address, '0x');

        let calcFee = (BigInt(1.2e5) * BigInt(500)) / PRECISION;

        expect(await pairVolatily.index0()).to.be.eq(ZERO);

        expect(await tokenTK6.balanceOf(await pairVolatily.fees())).to.be.eq(ZERO);

        expect(await tokenTK6.balanceOf(await pairVolatily.communityVault())).to.be.eq(calcFee);
      } else {
        await tokenTK6.mint(pairVolatily.target, BigInt(1.2e5));

        await pairVolatily.swap(1e5, 0, signers.deployer.address, '0x');

        let calcFee = (BigInt(1.2e5) * BigInt(500)) / PRECISION;

        expect(await pairVolatily.index1()).to.be.eq(ZERO);

        expect(await tokenTK6.balanceOf(await pairVolatily.fees())).to.be.eq(ZERO);

        expect(await tokenTK6.balanceOf(await pairVolatily.communityVault())).to.be.eq(calcFee);
      }
    });
    it('reverse case protocol fee 80%, volatility pair, custom fee 0.8%', async () => {
      await pairFactory.setCustomFee(pairVolatily.target, 80);
      await pairFactory.setCustomProtocolFee(pairVolatily.target, 8000);

      expect(await tokenTK18.balanceOf(await pairVolatily.communityVault())).to.be.eq(ZERO);

      await tokenTK18.mint(pairVolatily.target, ONE_ETHER);

      await tokenTK6.mint(pairVolatily.target, 1e6);

      await pairVolatily.mint(signers.deployer.address);

      if ((await pairVolatily.token0()) == tokenTK6.target) {
        await tokenTK6.mint(pairVolatily.target, BigInt(1.2e5));

        await pairVolatily.swap(0, 1e5, signers.deployer.address, '0x');

        let calcFee = (BigInt(1.2e5) * BigInt(80)) / PRECISION;

        let calcFeeToFees = (calcFee * BigInt(2000)) / PRECISION;

        calcFee = calcFee - calcFeeToFees;

        let calcIndex = (calcFeeToFees * ethers.parseEther('1')) / (await pairVolatily.totalSupply());

        expect(await pairVolatily.index0()).to.be.eq(calcIndex);

        expect(await tokenTK6.balanceOf(await pairVolatily.fees())).to.be.eq(calcFeeToFees);

        expect(await tokenTK6.balanceOf(await pairVolatily.communityVault())).to.be.eq(calcFee);
      } else {
        await tokenTK6.mint(pairVolatily.target, BigInt(1.2e5));

        await pairVolatily.swap(1e5, 0, signers.deployer.address, '0x');

        let calcFee = (BigInt(1.2e5) * BigInt(80)) / PRECISION;

        let calcFeeToFees = (calcFee * BigInt(2000)) / PRECISION;

        calcFee = calcFee - calcFeeToFees;

        let calcIndex = (calcFeeToFees * ethers.parseEther('1')) / (await pairVolatily.totalSupply());

        expect(await pairVolatily.index1()).to.be.eq(calcIndex);

        expect(await tokenTK6.balanceOf(await pairVolatily.fees())).to.be.eq(calcFeeToFees);

        expect(await tokenTK6.balanceOf(await pairVolatily.communityVault())).to.be.eq(calcFee);
      }
    });
  });
  describe('swaps fees corect calculate and transfer to feesVault for stable pairs', async () => {
    it('case protocol fee 0%, pairStable pair, stable fee 0.1% (MAX_FEE)', async () => {
      await pairFactory.setFee(true, 10);
      await pairFactory.setProtocolFee(0);

      expect(await deployed.fenix.balanceOf(await pairStable.communityVault())).to.be.eq(ZERO);

      await deployed.fenix.transfer(pairStable.target, ONE_ETHER);

      await tokenTK6.mint(pairStable.target, 1e6);

      await pairStable.mint(signers.deployer.address);

      if ((await pairStable.token0()) == deployed.fenix.target) {
        await deployed.fenix.transfer(pairStable.target, ethers.parseEther('0.12'));

        await pairStable.swap(0, 1e5, signers.deployer.address, '0x');

        let calcFee = (ethers.parseEther('0.12') * BigInt(10)) / PRECISION;
        let calcIndex = (calcFee * ethers.parseEther('1')) / (await pairStable.totalSupply());

        expect(await pairStable.index0()).to.be.eq(calcIndex);

        expect(await deployed.fenix.balanceOf(await pairStable.fees())).to.be.eq(calcFee);

        expect(await deployed.fenix.balanceOf(await pairStable.communityVault())).to.be.eq(ZERO);
      } else {
        await deployed.fenix.transfer(pairStable.target, ethers.parseEther('0.12'));

        await pairStable.swap(1e5, 0, signers.deployer.address, '0x');

        let calcFee = (ethers.parseEther('0.12') * BigInt(10)) / PRECISION;
        let calcIndex = (calcFee * ethers.parseEther('1')) / (await pairStable.totalSupply());

        expect(await pairStable.index1()).to.be.eq(calcIndex);

        expect(await deployed.fenix.balanceOf(await pairStable.fees())).to.be.eq(calcFee);

        expect(await deployed.fenix.balanceOf(await pairStable.communityVault())).to.be.eq(ZERO);
      }
    });
    it('case protocol fee 100%, pairStable pair, custom fee 5% (MAX_FEE)', async () => {
      await pairFactory.setCustomFee(pairStable.target, 500);
      await pairFactory.setCustomProtocolFee(pairStable.target, PRECISION);

      expect(await deployed.fenix.balanceOf(await pairStable.communityVault())).to.be.eq(ZERO);

      await deployed.fenix.transfer(pairStable.target, ONE_ETHER);

      await tokenTK6.mint(pairStable.target, 1e6);

      await pairStable.mint(signers.deployer.address);

      if ((await pairStable.token0()) == deployed.fenix.target) {
        await deployed.fenix.transfer(pairStable.target, ethers.parseEther('0.12'));

        await pairStable.swap(0, 1e5, signers.deployer.address, '0x');

        let calcFee = (ethers.parseEther('0.12') * BigInt(500)) / PRECISION;

        expect(await pairStable.index0()).to.be.eq(ZERO);

        expect(await deployed.fenix.balanceOf(await pairStable.fees())).to.be.eq(ZERO);

        expect(await deployed.fenix.balanceOf(await pairStable.communityVault())).to.be.eq(calcFee);
      } else {
        await deployed.fenix.transfer(pairStable.target, ethers.parseEther('0.12'));

        await pairStable.swap(1e5, 0, signers.deployer.address, '0x');

        let calcFee = (ethers.parseEther('0.12') * BigInt(500)) / PRECISION;

        expect(await pairStable.index1()).to.be.eq(ZERO);

        expect(await deployed.fenix.balanceOf(await pairStable.fees())).to.be.eq(ZERO);

        expect(await deployed.fenix.balanceOf(await pairStable.communityVault())).to.be.eq(calcFee);
      }
    });
    it('case protocol fee 80%, pairStable, custom fee 0.8%', async () => {
      await pairFactory.setCustomFee(pairStable.target, 80);
      await pairFactory.setCustomProtocolFee(pairStable.target, 8000);

      expect(await deployed.fenix.balanceOf(await pairStable.communityVault())).to.be.eq(ZERO);

      await deployed.fenix.transfer(pairStable.target, ONE_ETHER);

      await tokenTK6.mint(pairStable.target, 1e6);

      await pairStable.mint(signers.deployer.address);

      if ((await pairStable.token0()) == deployed.fenix.target) {
        await deployed.fenix.transfer(pairStable.target, ethers.parseEther('0.12'));

        await pairStable.swap(0, 1e5, signers.deployer.address, '0x');

        let calcFee = (ethers.parseEther('0.12') * BigInt(80)) / PRECISION;

        let calcFeeToFees = (calcFee * BigInt(2000)) / PRECISION;

        calcFee = calcFee - calcFeeToFees;

        let calcIndex = (calcFeeToFees * ethers.parseEther('1')) / (await pairStable.totalSupply());

        expect(await pairStable.index0()).to.be.eq(calcIndex);

        expect(await deployed.fenix.balanceOf(await pairStable.fees())).to.be.eq(calcFeeToFees);

        expect(await deployed.fenix.balanceOf(await pairStable.communityVault())).to.be.eq(calcFee);
      } else {
        await deployed.fenix.transfer(pairStable.target, ethers.parseEther('0.12'));

        await pairStable.swap(1e5, 0, signers.deployer.address, '0x');

        let calcFee = (ethers.parseEther('0.12') * BigInt(80)) / PRECISION;

        let calcFeeToFees = (calcFee * BigInt(2000)) / PRECISION;

        calcFee = calcFee - calcFeeToFees;

        let calcIndex = (calcFeeToFees * ethers.parseEther('1')) / (await pairStable.totalSupply());

        expect(await pairStable.index1()).to.be.eq(calcIndex);

        expect(await deployed.fenix.balanceOf(await pairStable.fees())).to.be.eq(calcFeeToFees);

        expect(await deployed.fenix.balanceOf(await pairStable.communityVault())).to.be.eq(calcFee);
      }
    });
    it('reverse case protocol fee 100%, volatility pair, custom fee 5% (MAX_FEE)', async () => {
      await pairFactory.setCustomFee(pairStable.target, 500);
      await pairFactory.setCustomProtocolFee(pairStable.target, PRECISION);

      expect(await deployed.fenix.balanceOf(await pairStable.communityVault())).to.be.eq(ZERO);

      await deployed.fenix.transfer(pairStable.target, ONE_ETHER);

      await tokenTK6.mint(pairStable.target, 1e6);

      await pairStable.mint(signers.deployer.address);

      if ((await pairStable.token0()) == tokenTK6.target) {
        await tokenTK6.mint(pairStable.target, BigInt(1.2e5));

        await pairStable.swap(0, 1e5, signers.deployer.address, '0x');

        let calcFee = (BigInt(1.2e5) * BigInt(500)) / PRECISION;

        expect(await pairStable.index0()).to.be.eq(ZERO);

        expect(await tokenTK6.balanceOf(await pairStable.fees())).to.be.eq(ZERO);

        expect(await tokenTK6.balanceOf(await pairStable.communityVault())).to.be.eq(calcFee);
      } else {
        await tokenTK6.mint(pairStable.target, BigInt(1.2e5));

        await pairStable.swap(1e5, 0, signers.deployer.address, '0x');

        let calcFee = (BigInt(1.2e5) * BigInt(500)) / PRECISION;

        expect(await pairStable.index1()).to.be.eq(ZERO);

        expect(await tokenTK6.balanceOf(await pairStable.fees())).to.be.eq(ZERO);

        expect(await tokenTK6.balanceOf(await pairStable.communityVault())).to.be.eq(calcFee);
      }
    });
    it('reverse case protocol fee 80%, pairStable, custom fee 0.8%', async () => {
      await pairFactory.setCustomFee(pairStable.target, 80);
      await pairFactory.setCustomProtocolFee(pairStable.target, 8000);

      expect(await deployed.fenix.balanceOf(await pairStable.communityVault())).to.be.eq(ZERO);

      await deployed.fenix.transfer(pairStable.target, ONE_ETHER);

      await tokenTK6.mint(pairStable.target, 1e6);

      await pairStable.mint(signers.deployer.address);

      if ((await pairStable.token0()) == tokenTK6.target) {
        await tokenTK6.mint(pairStable.target, BigInt(1.2e5));

        await pairStable.swap(0, 1e5, signers.deployer.address, '0x');

        let calcFee = (BigInt(1.2e5) * BigInt(80)) / PRECISION;

        let calcFeeToFees = (calcFee * BigInt(2000)) / PRECISION;

        calcFee = calcFee - calcFeeToFees;

        let calcIndex = (calcFeeToFees * ethers.parseEther('1')) / (await pairStable.totalSupply());

        expect(await pairStable.index0()).to.be.eq(calcIndex);

        expect(await tokenTK6.balanceOf(await pairStable.fees())).to.be.eq(calcFeeToFees);

        expect(await tokenTK6.balanceOf(await pairStable.communityVault())).to.be.eq(calcFee);
      } else {
        await tokenTK6.mint(pairStable.target, BigInt(1.2e5));

        await pairStable.swap(1e5, 0, signers.deployer.address, '0x');

        let calcFee = (BigInt(1.2e5) * BigInt(80)) / PRECISION;

        let calcFeeToFees = (calcFee * BigInt(2000)) / PRECISION;

        calcFee = calcFee - calcFeeToFees;

        let calcIndex = (calcFeeToFees * ethers.parseEther('1')) / (await pairStable.totalSupply());

        expect(await pairStable.index1()).to.be.eq(calcIndex);

        expect(await tokenTK6.balanceOf(await pairStable.fees())).to.be.eq(calcFeeToFees);

        expect(await tokenTK6.balanceOf(await pairStable.communityVault())).to.be.eq(calcFee);
      }
    });
  });
  describe('#burn', async () => {
    it('should revert when trying to remove all liquidity from stable pair (K below MINIMUM_K)', async () => {
      // Add liquidity to the stable pair
      await deployed.fenix.transfer(pairStable.target, ONE_ETHER);
      await tokenTK6.mint(pairStable.target, 1e6);
      await pairStable.mint(signers.deployer.address);

      // Get all LP tokens (except MINIMUM_LIQUIDITY locked)
      const lpBalance = await pairStable.balanceOf(signers.deployer.address);
      // Transfer all LP tokens to the pair to burn them
      await pairStable.transfer(pairStable.target, lpBalance);

      // Attempting to burn all liquidity should revert because K would fall below MINIMUM_K
      await expect(pairStable.burn(signers.deployer.address)).to.be.revertedWith(
        'Pair: K must be greater than minimum k',
      );
    });

    it('should revert when trying to remove all liquidity from volatile pair (K below MINIMUM_K)', async () => {
      // Add liquidity to the volatile pair
      await tokenTK18.mint(pairVolatily.target, ONE_ETHER);
      await tokenTK6.mint(pairVolatily.target, 1e6);
      await pairVolatily.mint(signers.deployer.address);

      // Get all LP tokens (except MINIMUM_LIQUIDITY locked)
      const lpBalance = await pairVolatily.balanceOf(signers.deployer.address);

      // Transfer all LP tokens to the pair to burn them
      await pairVolatily.transfer(pairVolatily.target, lpBalance);

      // Attempting to burn all liquidity should revert because K would fall below MINIMUM_K
      await expect(pairVolatily.burn(signers.deployer.address)).to.be.revertedWith(
        'Pair: K must be greater than minimum k',
      );
    });

    it('should successfully burn partial liquidity from volatile pair', async () => {
      // Add liquidity to the volatile pair
      await tokenTK18.mint(pairVolatily.target, ONE_ETHER);
      await tokenTK6.mint(pairVolatily.target, 1e6);
      await pairVolatily.mint(signers.deployer.address);

      // Get LP balance
      const lpBalance = await pairVolatily.balanceOf(signers.deployer.address);

      // Transfer only half of the LP tokens to burn
      const halfLpBalance = lpBalance / 2n;
      await pairVolatily.transfer(pairVolatily.target, halfLpBalance);

      // Get balances before burn
      const token0 = await pairVolatily.token0();
      const token1 = await pairVolatily.token1();
      const token0Contract = token0 === tokenTK18.target ? tokenTK18 : tokenTK6;
      const token1Contract = token0 === tokenTK18.target ? tokenTK6 : tokenTK18;

      const balanceBefore0 = await token0Contract.balanceOf(signers.deployer.address);
      const balanceBefore1 = await token1Contract.balanceOf(signers.deployer.address);

      // Burn partial liquidity should succeed
      await expect(pairVolatily.burn(signers.deployer.address)).to.emit(pairVolatily, 'Burn');

      // Verify tokens were received
      const balanceAfter0 = await token0Contract.balanceOf(signers.deployer.address);
      const balanceAfter1 = await token1Contract.balanceOf(signers.deployer.address);

      expect(balanceAfter0).to.be.gt(balanceBefore0);
      expect(balanceAfter1).to.be.gt(balanceBefore1);
    });

    it('should successfully burn partial liquidity from stable pair', async () => {
      // Add liquidity to the stable pair
      await deployed.fenix.transfer(pairStable.target, ONE_ETHER);
      await tokenTK6.mint(pairStable.target, 1e6);
      await pairStable.mint(signers.deployer.address);

      // Get LP balance
      const lpBalance = await pairStable.balanceOf(signers.deployer.address);

      // Transfer only half of the LP tokens to burn
      const halfLpBalance = lpBalance / 2n;
      await pairStable.transfer(pairStable.target, halfLpBalance);

      // Get balances before burn
      const token0 = await pairStable.token0();
      const token0Contract = token0 === deployed.fenix.target ? deployed.fenix : tokenTK6;
      const token1Contract = token0 === deployed.fenix.target ? tokenTK6 : deployed.fenix;

      const balanceBefore0 = await token0Contract.balanceOf(signers.deployer.address);
      const balanceBefore1 = await token1Contract.balanceOf(signers.deployer.address);

      // Burn partial liquidity should succeed
      await expect(pairStable.burn(signers.deployer.address)).to.emit(pairStable, 'Burn');

      // Verify tokens were received
      const balanceAfter0 = await token0Contract.balanceOf(signers.deployer.address);
      const balanceAfter1 = await token1Contract.balanceOf(signers.deployer.address);

      expect(balanceAfter0).to.be.gt(balanceBefore0);
      expect(balanceAfter1).to.be.gt(balanceBefore1);
    });
  });
  describe('#setCommunityVault', async () => {
    it('fails if caller is not PAIRS_ADMINISTRATOR', async () => {
      await expect(pairVolatily.connect(signers.otherUser1).setCommunityVault(signers.otherUser1)).to.be.revertedWith('ACCESS_DENIED');
    });
    it('should corect set new community vault and emit event', async () => {
      await expect(pairVolatily.connect(signers.otherUser1).setCommunityVault(signers.otherUser1)).to.be.revertedWith('ACCESS_DENIED');

      await pairFactory.grantRole(await pairFactory.PAIRS_ADMINISTRATOR_ROLE(), signers.otherUser1.address);

      expect(await pairVolatily.communityVault()).to.be.not.eq(signers.otherUser1.address);
      await expect(pairVolatily.connect(signers.otherUser1).setCommunityVault(signers.otherUser1))
        .to.be.emit(pairVolatily, 'SetCommunityVault')
        .withArgs(signers.otherUser1);
      expect(await pairVolatily.communityVault()).to.be.eq(signers.otherUser1.address);
    });
  });
});
