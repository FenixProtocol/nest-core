import { abi as POOL_ABI } from '@cryptoalgebra/integral-core/artifacts/contracts/AlgebraPool.sol/AlgebraPool.json';
import { encodePriceSqrt } from '@cryptoalgebra/integral-core/test/shared/utilities';
import { loadFixture, mine, time } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect, use } from 'chai';
import { ethers } from 'hardhat';
import * as typechainTypes from '../../../typechain-types';
import { ERRORS, ONE_ETHER, WEEK, ZERO, ZERO_ADDRESS } from '../../utils/constants';
import completeFixture, {
  CoreFixtureDeployed,
  SignersList,
  deployAlgebraCore,
  deployERC20MockToken,
  deployTransaperntUpgradeableProxy,
} from '../../utils/coreFixture';
import { VotingEscrowUpgradeableV2 } from '../../../typechain-types';
import { ContractTransactionResponse } from 'ethers';

describe('VotingEscrow-depositToAttachedNFT', function () {
  let deployed: CoreFixtureDeployed;
  let signers: SignersList;
  let voter: typechainTypes.VoterUpgradeableV2;

  let votingEscrow: VotingEscrowUpgradeableV2;
  let veBoost: typechainTypes.VeBoostUpgradeable;
  let managedNFTManager: typechainTypes.ManagedNFTManagerUpgradeable;

  let fenix: typechainTypes.Fenix;
  let tokenTR6: typechainTypes.ERC20Mock;
  let priceProvider: typechainTypes.AlgebraFNXPriceProviderUpgradeable;
  let strategyFactory: typechainTypes.CompoundVeFNXManagedNFTStrategyFactoryUpgradeable;
  let routerV2: typechainTypes.RouterV2;
  let routerV2PathProvider: typechainTypes.RouterV2PathProviderUpgradeable;

  async function deployStrategyFactory() {
    strategyFactory = (await ethers.getContractAt(
      'CompoundVeFNXManagedNFTStrategyFactoryUpgradeable',
      (
        await deployTransaperntUpgradeableProxy(
          signers.deployer,
          signers.proxyAdmin.address,
          await (await ethers.deployContract('CompoundVeFNXManagedNFTStrategyFactoryUpgradeable', [])).getAddress(),
        )
      ).target,
    )) as typechainTypes.CompoundVeFNXManagedNFTStrategyFactoryUpgradeable;

    routerV2PathProvider = (await ethers.getContractFactory('RouterV2PathProviderUpgradeable')).attach(
      (
        await deployTransaperntUpgradeableProxy(
          signers.deployer,
          signers.proxyAdmin.address,
          await (await ethers.deployContract('RouterV2PathProviderUpgradeable', [])).getAddress(),
        )
      ).target,
    ) as typechainTypes.RouterV2PathProviderUpgradeable;

    routerV2 = await ethers.deployContract('RouterV2', [deployed.v2PairFactory.target, ethers.Wallet.createRandom()]);

    await routerV2PathProvider.initialize(deployed.v2PairFactory.target, routerV2.target);

    await strategyFactory.initialize(
      (
        await ethers.deployContract('CompoundVeFNXManagedNFTStrategyUpgradeable', [])
      ).target,
      (
        await ethers.deployContract('SingelTokenVirtualRewarderUpgradeable', [])
      ).target,
      managedNFTManager.target,
      routerV2PathProvider.target,
    );
  }

  async function deployPriceProviderWith(
    usdToken: typechainTypes.ERC20Mock,
    usdReserve: bigint,
    fnxReserve: bigint,
  ): Promise<typechainTypes.AlgebraFNXPriceProviderUpgradeable> {
    let factoryPriceProvider = await ethers.getContractFactory('AlgebraFNXPriceProviderUpgradeable');
    let implementationPriceProvider = await factoryPriceProvider.deploy();
    priceProvider = factoryPriceProvider.attach(
      await deployTransaperntUpgradeableProxy(signers.deployer, signers.proxyAdmin.address, await implementationPriceProvider.getAddress()),
    ) as typechainTypes.AlgebraFNXPriceProviderUpgradeable;

    let algebraCore = await deployAlgebraCore();

    let algebraFactory = algebraCore.factory;
    await algebraFactory.grantRole(await algebraFactory.POOLS_CREATOR_ROLE(), signers.deployer.address);

    let deployedPoolAddr = await algebraCore.factory.createPool.staticCall(fenix.target, usdToken.target);

    await algebraCore.factory.createPool(fenix.target, usdToken.target);
    let pool = await ethers.getContractAt(POOL_ABI, deployedPoolAddr);

    let price = encodePriceSqrt(usdReserve, fnxReserve);
    if ((await pool.token0()) == usdToken.target) {
      price = encodePriceSqrt(fnxReserve, usdReserve);
    }
    await pool.initialize(price);

    await priceProvider.initialize(pool.target, fenix.target, usdToken.target);
    return priceProvider;
  }

  async function newStrategy() {
    let strategy = await ethers.getContractAt(
      'CompoundVeFNXManagedNFTStrategyUpgradeable',
      await strategyFactory.createStrategy.staticCall('VeMax'),
    );
    await strategyFactory.createStrategy('VeMax');
    return strategy;
  }
  let mVeNftId: bigint;
  let strategy: typechainTypes.CompoundVeFNXManagedNFTStrategyUpgradeable;
  let virtualRewarder: typechainTypes.SingelTokenVirtualRewarderUpgradeable;
  let userNftId: bigint;

  beforeEach(async function () {
    deployed = await loadFixture(completeFixture);
    signers = deployed.signers;
    fenix = deployed.fenix;
    veBoost = deployed.veBoost;
    voter = deployed.voter;
    votingEscrow = deployed.votingEscrow;
    managedNFTManager = deployed.managedNFTManager;
    tokenTR6 = await deployERC20MockToken(signers.deployer, 'TR6', 'TR6', 6);

    await deployStrategyFactory();

    await veBoost.initialize(fenix.target, votingEscrow.target, (await deployPriceProviderWith(tokenTR6, BigInt(1e6), ONE_ETHER)).target);
    await veBoost.setMinUSDAmount(1);
    await votingEscrow.updateAddress('veBoost', veBoost.target);
    mVeNftId = 1n;

    strategy = await newStrategy();
    virtualRewarder = await ethers.getContractAt('SingelTokenVirtualRewarderUpgradeable', await strategy.virtualRewarder());

    await managedNFTManager.createManagedNFT(strategy);

    await fenix.approve(votingEscrow.target, ethers.parseEther('10'));
    await votingEscrow.createLockFor(ethers.parseEther('1'), 0, signers.deployer.address, false, true, 0);
    userNftId = await votingEscrow.lastMintedTokenId();
  });

  describe('isTransferable', async () => {
    it('fail if call for not exists token id', async () => {
      await expect(votingEscrow.isTransferable(3)).to.be.revertedWith('ERC721: invalid token ID');
    });

    describe('always return true', async () => {
      it('for managed nft', async () => {
        expect(await votingEscrow.isTransferable(mVeNftId)).to.be.true;
      });

      it('return true if user nft attached ', async () => {
        await voter.attachToManagedNFT(userNftId, mVeNftId);
        expect(await votingEscrow.isTransferable(userNftId)).to.be.true;
        await expect(votingEscrow.transferFrom(signers.deployer.address, signers.otherUser1.address, userNftId)).to.be.not.reverted;
      });
    });
  });
});
