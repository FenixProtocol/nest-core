import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { ERRORS } from '../utils/constants';

import { ManualNESTPriceProvider } from '../../typechain-types';
import { getSigners } from '../utils/coreFixture';

describe('ManualNESTPriceProvider', function () {
  let instance: ManualNESTPriceProvider;
  let initialPrice = ethers.parseEther('1');
  let owner: HardhatEthersSigner;
  let user: HardhatEthersSigner;

  before(async function () {
    let signers = await getSigners();
    [owner, user] = [signers.deployer, signers.otherUser1];
    instance = await ethers.deployContract('ManualNESTPriceProvider', [initialPrice]);
  });

  describe('Deployment', function () {
    it('success setup deployer, like owner', async () => {
      expect(await instance.owner()).to.be.eq(owner.address);
    });
    it('success setup initial price', async () => {
      expect(await instance.price()).to.be.eq(initialPrice);
      expect(await instance.getUsdToNESTPrice()).to.be.eq(initialPrice);
    });
  });

  describe('#setNestPrice', async () => {
    it('fail if call from not owner', async () => {
      await expect(instance.connect(user).setNestPrice(1)).to.be.revertedWith(ERRORS.Ownable.NotOwner);
    });

    it('success update price and emit events', async () => {
      await expect(instance.setNestPrice(initialPrice)).to.be.emit(instance, 'SetPrice').withArgs(initialPrice, initialPrice);
      expect(await instance.getUsdToNESTPrice()).to.be.eq(initialPrice);
      expect(await instance.price()).to.be.eq(initialPrice);

      await expect(instance.setNestPrice(1)).to.be.emit(instance, 'SetPrice').withArgs(initialPrice, 1);
      expect(await instance.getUsdToNESTPrice()).to.be.eq(1);
      expect(await instance.price()).to.be.eq(1);

      await expect(instance.setNestPrice(0)).to.be.emit(instance, 'SetPrice').withArgs(1, 0);
      await expect(instance.getUsdToNESTPrice()).to.be.revertedWithCustomError(instance, 'PriceNotSetup');
      expect(await instance.price()).to.be.eq(0);

      await expect(instance.setNestPrice(ethers.parseEther('1.23456789')))
        .to.be.emit(instance, 'SetPrice')
        .withArgs(0, ethers.parseEther('1.23456789'));
      expect(await instance.getUsdToNESTPrice()).to.be.eq(ethers.parseEther('1.23456789'));
      expect(await instance.price()).to.be.eq(ethers.parseEther('1.23456789'));
    });
  });

  describe('#getUsdToNESTPrice', async () => {
    it('fail if price eq = 0', async () => {
      await instance.setNestPrice(0);
      expect(await instance.price()).to.be.eq(0);
      await expect(instance.getUsdToNESTPrice()).to.be.revertedWithCustomError(instance, 'PriceNotSetup');
    });

    it('return actual price', async () => {
      await instance.setNestPrice(initialPrice);
      expect(await instance.getUsdToNESTPrice()).to.be.eq(initialPrice);
      await instance.setNestPrice(1);
      expect(await instance.getUsdToNESTPrice()).to.be.eq(1);
      await instance.setNestPrice(11);
      expect(await instance.getUsdToNESTPrice()).to.be.eq(11);
      await instance.setNestPrice(ethers.parseEther('1.23456789'));
      expect(await instance.getUsdToNESTPrice()).to.be.eq(ethers.parseEther('1.23456789'));
    });
  });
});
