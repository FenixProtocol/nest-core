import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { setCode } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { Nest } from '../../typechain-types/index';
import { ERRORS, ONE, ONE_ETHER, ZERO } from '../utils/constants';

describe('Nest Contract', function () {
  let nestInstance: Nest;
  let emissionManager: HardhatEthersSigner;
  let otherUser: HardhatEthersSigner;
  let deployer: HardhatEthersSigner;

  let tokenSetting = {
    name: 'Nest',
    symbol: 'NEST',
    decimals: 18,
    initialTotalSupply: ethers.parseEther('1000000000'),
  };

  before(async function () {
    const Nest = await ethers.getContractFactory('Nest');
    [deployer, emissionManager, otherUser] = await ethers.getSigners();
    nestInstance = (await Nest.deploy(await emissionManager.getAddress())) as Nest;
  });

  describe('Deployment', function () {
    it('Should set the right emission manager like owner', async function () {
      expect(await nestInstance.owner()).to.equal(await emissionManager.getAddress());
    });
    it('Should correct set default token settings', async function () {
      expect(await nestInstance.name()).to.equal(tokenSetting.name);
      expect(await nestInstance.symbol()).to.equal(tokenSetting.symbol);
      expect(await nestInstance.decimals()).to.equal(tokenSetting.decimals);
      expect(await nestInstance.totalSupply()).to.equal(tokenSetting.initialTotalSupply);
    });
    it('Should correct mint initial supply to deployer', async function () {
      expect(await nestInstance.balanceOf(deployer.address)).to.be.equal(tokenSetting.initialTotalSupply);
    });
  });

  describe('Minting', function () {
    it('Should mint new tokens and increase totalSupply correctly', async function () {
      expect(await nestInstance.totalSupply()).to.equal(tokenSetting.initialTotalSupply);
      expect(await nestInstance.balanceOf(await otherUser.getAddress())).to.equal(ZERO);

      await nestInstance.connect(emissionManager).mint(await otherUser.getAddress(), 1);

      expect(await nestInstance.balanceOf(await otherUser.getAddress())).to.equal(ONE);

      expect(await nestInstance.totalSupply()).to.equal(tokenSetting.initialTotalSupply + ONE);

      await nestInstance.connect(emissionManager).mint(await deployer.getAddress(), ONE_ETHER);
      expect(await nestInstance.balanceOf(await deployer.getAddress())).to.equal(tokenSetting.initialTotalSupply + ONE_ETHER);
      expect(await nestInstance.totalSupply()).to.equal(tokenSetting.initialTotalSupply + ONE_ETHER + ONE);
    });

    it('Should be fail, if called from not owner', async function () {
      await expect(nestInstance.connect(otherUser).mint(await otherUser.getAddress(), ONE_ETHER)).to.be.revertedWith(
        ERRORS.Ownable.NotOwner,
      );
    });
  });
});
