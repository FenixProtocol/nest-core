import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { loadFixture, time } from '@nomicfoundation/hardhat-toolbox/network-helpers';

import { expect } from 'chai';
import { ethers } from 'hardhat';
import {
  ERC20Mock,
  Pair,
  RouterV2,
  RouterV2PathProviderUpgradeable,
  SingleTokenBuybackUpgradeableMock,
  SingleTokenBuybackUpgradeableMock__factory,
} from '../../typechain-types';
import { ERRORS, ONE_ETHER, ZERO, ZERO_ADDRESS } from '../utils/constants';
import completeFixture, {
  CoreFixtureDeployed,
  SignersList,
  deployERC20MockToken,
  deployTransaperntUpgradeableProxy,
  getSigners,
} from '../utils/coreFixture';

describe('SingleTokenBuybackUpgradeable Contract', function () {
  let signers: SignersList;

  let pathProvider: RouterV2PathProviderUpgradeable;
  let factory: SingleTokenBuybackUpgradeableMock__factory;
  let singelTokenBuyback: SingleTokenBuybackUpgradeableMock;
  let singelTokenBuybackImpl: SingleTokenBuybackUpgradeableMock;

  let deployed: CoreFixtureDeployed;

  let routerV2: RouterV2;

  let USDT: ERC20Mock;
  let WETH: ERC20Mock;
  let FENIX: ERC20Mock;

  async function createPairWithObservation(
    signer: HardhatEthersSigner,
    tokenA: ERC20Mock,
    tokenB: ERC20Mock,
    stable: boolean,
    reserveA: any,
    reserveB: any,
  ): Promise<Pair> {
    await deployed.v2PairFactory.connect(signer).createPair(tokenA.target, tokenB.target, stable);

    let pair = await ethers.getContractAt('Pair', await deployed.v2PairFactory.getPair(tokenA.target, tokenB.target, stable));

    await tokenA.mint(pair.target, reserveA);
    await tokenB.mint(pair.target, reserveB);
    await pair.mint(signer.address);

    await time.increase(1801);

    await tokenA.mint(pair.target, reserveA);
    await tokenB.mint(pair.target, reserveB);
    await pair.mint(signer.address);

    await time.increase(1801);

    await tokenA.mint(pair.target, reserveA);
    await tokenB.mint(pair.target, reserveB);
    await pair.mint(signer.address);
    await time.increase(1801);

    await tokenA.mint(pair.target, reserveA);
    await tokenB.mint(pair.target, reserveB);
    await pair.mint(signer.address);
    await time.increase(1801);
    return pair;
  }

  beforeEach(async function () {
    deployed = await loadFixture(completeFixture);
    signers = await getSigners();

    USDT = await deployERC20MockToken(signers.deployer, 'USDT', 'USDT', 6);
    WETH = await deployERC20MockToken(signers.deployer, 'WETH', 'WETH', 18);
    FENIX = await deployERC20MockToken(signers.deployer, 'FENIX', 'FNX', 18);

    let pathProviderFactory = await ethers.getContractFactory('RouterV2PathProviderUpgradeable');
    let pathProviderImpl = await pathProviderFactory.deploy();

    pathProvider = pathProviderFactory.attach(
      (await deployTransaperntUpgradeableProxy(signers.deployer, signers.proxyAdmin.address, await pathProviderImpl.getAddress())).target,
    ) as any as RouterV2PathProviderUpgradeable;

    routerV2 = await ethers.deployContract('RouterV2', [deployed.v2PairFactory.target, ethers.Wallet.createRandom()]);
    await pathProvider.initialize(deployed.v2PairFactory.target, routerV2.target);

    factory = await ethers.getContractFactory('SingleTokenBuybackUpgradeableMock');
    singelTokenBuybackImpl = await factory.deploy();

    singelTokenBuyback = (await ethers.getContractAt(
      'SingleTokenBuybackUpgradeableMock',
      (
        await deployTransaperntUpgradeableProxy(signers.deployer, signers.proxyAdmin.address, await singelTokenBuybackImpl.getAddress())
      ).target,
    )) as any as SingleTokenBuybackUpgradeableMock;

    await singelTokenBuyback.initialize(pathProvider.target, FENIX.target);
  });

  describe('Deployment', async () => {
    it('fail if try initialize second time', async () => {
      await expect(singelTokenBuyback.initialize(pathProvider.target, FENIX.target)).to.be.revertedWith(ERRORS.Initializable.Initialized);
    });

    it('correct set provided params', async () => {
      expect(await singelTokenBuyback.routerV2PathProvider()).to.be.eq(pathProvider.target);
      expect(await singelTokenBuyback.owner()).to.be.eq(signers.deployer);
    });

    it('correct init params', async () => {
      expect(await singelTokenBuyback.MAX_SLIPPAGE()).to.be.eq(400);
      expect(await singelTokenBuyback.SLIPPAGE_PRECISION()).to.be.eq(10000);
    });
  });
  describe('#getBuybackTargetToken', async () => {
    it('should return correct target token', async () => {
      expect(await singelTokenBuyback.getBuybackTargetToken()).to.be.eq(FENIX.target);
    });
  });
});
