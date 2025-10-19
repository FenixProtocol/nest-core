import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { setCode, time, mine, loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { ERC20Mock, NestRaiseUpgradeable, TokenPublicRaiseUpgradeable, VotingEscrowUpgradeableV2 } from '../../typechain-types/index';
import { ERRORS, ONE, ONE_ETHER, ZERO, ZERO_ADDRESS } from '../utils/constants';
import completeFixture, { CoreFixtureDeployed, deployERC20MockToken } from '../utils/coreFixture';
import { deploy } from '@openzeppelin/hardhat-upgrades/dist/utils';
import { StandardMerkleTree } from '@openzeppelin/merkle-tree';
import { Signer } from '@ethersproject/abstract-signer';
import { EventEmitterWrapper } from 'hardhat/internal/util/event-emitter';
import { ContractTransactionResponse } from 'ethers';

describe('TokenPublicRaise Contract', function () {
  let implementation: TokenPublicRaiseUpgradeable;
  let proxy: TokenPublicRaiseUpgradeable;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;
  let user3: HardhatEthersSigner;
  let deployer: HardhatEthersSigner;
  let proxyAdmin: HardhatEthersSigner;
  let tresuary: HardhatEthersSigner;

  let DEFAULT_START_TIMESTAMP:number;
  let DEFAULT_END_TIMESTAMP:number;
  let DEFAULT_MIN_DEPOSIT_AMOUNT:bigint;
  let DEFAULT_MAX_DEPOSIT_AMOUNT:bigint;
  let DEFAULT_TOTAL_DEPOSIT_LIMIT:bigint;
  let DEFAULT_PRICE_PER_ONE_NATIVE_COIN:bigint;
  let initializeTx: ContractTransactionResponse;

  async function expectInfoSnapshot(
    proxy: TokenPublicRaiseUpgradeable,
    userAddr: string,
    expected: {
      active: boolean;
      start: number;
      end: number;
      minPerTx: bigint;
      maxPerUser: bigint;
      globalCap: bigint;
      rate: bigint;
      totalIn: bigint;
      userIn: bigint;
      userOut: bigint;
      userMaxDeposit: bigint
    },
  ) {
    const info = await proxy.getInfo(userAddr);
    expect(info[0]).to.eq(expected.active);
    expect(info[1]).to.eq(expected.start);
    expect(info[2]).to.eq(expected.end);
    expect(info[3]).to.eq(expected.minPerTx);
    expect(info[4]).to.eq(expected.maxPerUser);
    expect(info[5]).to.eq(expected.globalCap);
    expect(info[6]).to.eq(expected.rate);
    expect(info[7]).to.eq(expected.totalIn);
    expect(info[8]).to.eq(expected.userIn);
    expect(info[9]).to.eq(expected.userOut);
    expect(info[10]).to.eq(expected.userMaxDeposit);
  }

  beforeEach(async function () {
    [deployer, proxyAdmin, tresuary, user1, user2, user3] = await ethers.getSigners();

    implementation = await ethers.deployContract('TokenPublicRaiseUpgradeable', []);
    proxy = await ethers.getContractAt(
      'TokenPublicRaiseUpgradeable',
      (
        await ethers.deployContract('TransparentUpgradeableProxy', [implementation.target, proxyAdmin.address, '0x'])
      ).target,
    );
    DEFAULT_START_TIMESTAMP = await time.latest() + 3600;
    DEFAULT_END_TIMESTAMP = DEFAULT_START_TIMESTAMP + 86400;
    DEFAULT_MIN_DEPOSIT_AMOUNT = ethers.parseEther('1');
    DEFAULT_MAX_DEPOSIT_AMOUNT = ethers.parseEther('200');
    DEFAULT_TOTAL_DEPOSIT_LIMIT = ethers.parseEther('500');
    DEFAULT_PRICE_PER_ONE_NATIVE_COIN = ethers.parseEther('10.5')

    initializeTx = await proxy.initialize(DEFAULT_START_TIMESTAMP, DEFAULT_END_TIMESTAMP, DEFAULT_MIN_DEPOSIT_AMOUNT, DEFAULT_MAX_DEPOSIT_AMOUNT, DEFAULT_TOTAL_DEPOSIT_LIMIT, DEFAULT_PRICE_PER_ONE_NATIVE_COIN, tresuary);
  });

  describe("Initialization", async() => {
    it("emits all setup events with correct args", async() => {
      await expect(initializeTx).to.be.emit(proxy, 'TreasuryUpdated').withArgs(tresuary);
      await expect(initializeTx).to.be.emit(proxy, 'DepositLimitsUpdated').withArgs(DEFAULT_MIN_DEPOSIT_AMOUNT, DEFAULT_MAX_DEPOSIT_AMOUNT, DEFAULT_TOTAL_DEPOSIT_LIMIT);
      await expect(initializeTx).to.be.emit(proxy, 'RaiseWindowUpdated').withArgs(DEFAULT_START_TIMESTAMP, DEFAULT_END_TIMESTAMP);
      await expect(initializeTx).to.be.emit(proxy, 'ExchangeRateUpdated').withArgs(DEFAULT_PRICE_PER_ONE_NATIVE_COIN);
    })

    it("stores config & initial state correctly", async() => {
      expect(await proxy.startTimestamp()).to.be.eq(DEFAULT_START_TIMESTAMP);
      expect(await proxy.endTimestamp()).to.be.eq(DEFAULT_END_TIMESTAMP);
      expect(await proxy.minDepositAmount()).to.be.eq(DEFAULT_MIN_DEPOSIT_AMOUNT);
      expect(await proxy.maxDepositAmount()).to.be.eq(DEFAULT_MAX_DEPOSIT_AMOUNT);
      expect(await proxy.totalDepositCap()).to.be.eq(DEFAULT_TOTAL_DEPOSIT_LIMIT);
      expect(await proxy.treasury()).to.be.eq(tresuary);

      expect(await proxy.totalDeposited()).to.be.eq(ZERO);
      expect(await proxy.userDeposited(user1)).to.be.eq(ZERO)
      expect(await proxy.userDeposited(user2)).to.be.eq(ZERO)
      expect(await proxy.userDeposited(user3)).to.be.eq(ZERO)
      expect(await proxy.userTokensAllocated(user1)).to.be.eq(ZERO)
      expect(await proxy.userTokensAllocated(user2)).to.be.eq(ZERO)
      expect(await proxy.userTokensAllocated(user3)).to.be.eq(ZERO)
    })

    it('getInfo() reflects defaults for any address', async() => {
      await expectInfoSnapshot(proxy, ethers.ZeroAddress, {
        active: false,
        start: DEFAULT_START_TIMESTAMP,
        end: DEFAULT_END_TIMESTAMP,
        minPerTx: DEFAULT_MIN_DEPOSIT_AMOUNT,
        maxPerUser: DEFAULT_MAX_DEPOSIT_AMOUNT,
        globalCap: DEFAULT_TOTAL_DEPOSIT_LIMIT,
        rate: DEFAULT_PRICE_PER_ONE_NATIVE_COIN,
        totalIn: 0n,
        userIn: 0n,
        userOut: 0n,
        userMaxDeposit: 0n
      });
      await expectInfoSnapshot(proxy, user1.address, {
        active: false,
        start: DEFAULT_START_TIMESTAMP,
        end: DEFAULT_END_TIMESTAMP,
        minPerTx: DEFAULT_MIN_DEPOSIT_AMOUNT,
        maxPerUser: DEFAULT_MAX_DEPOSIT_AMOUNT,
        globalCap: DEFAULT_TOTAL_DEPOSIT_LIMIT,
        rate: DEFAULT_PRICE_PER_ONE_NATIVE_COIN,
        totalIn: 0n,
        userIn: 0n,
        userOut: 0n,
        userMaxDeposit: 0n
      });
    })
  })
  
  describe('Deployment guards', function () {
    let emptyProxy: TokenPublicRaiseUpgradeable;

    beforeEach(async() => {
      emptyProxy  = await ethers.getContractAt(
        'TokenPublicRaiseUpgradeable',
        (
          await ethers.deployContract('TransparentUpgradeableProxy', [implementation.target, proxyAdmin.address, '0x'])
        ).target,
      );
    });

    it('prevents initialize on implementation', async () => {
      await expect(
        implementation.initialize(DEFAULT_START_TIMESTAMP, DEFAULT_END_TIMESTAMP, DEFAULT_MIN_DEPOSIT_AMOUNT, DEFAULT_MAX_DEPOSIT_AMOUNT, DEFAULT_TOTAL_DEPOSIT_LIMIT, DEFAULT_PRICE_PER_ONE_NATIVE_COIN, tresuary),
      ).to.be.revertedWith(ERRORS.Initializable.Initialized);
    });

    it('prevents re-initialize on proxy', async () => {
      await expect(
        proxy.initialize(DEFAULT_START_TIMESTAMP, DEFAULT_END_TIMESTAMP, DEFAULT_MIN_DEPOSIT_AMOUNT, DEFAULT_MAX_DEPOSIT_AMOUNT, DEFAULT_TOTAL_DEPOSIT_LIMIT, DEFAULT_PRICE_PER_ONE_NATIVE_COIN, tresuary),
      ).to.be.revertedWith(ERRORS.Initializable.Initialized);
    });


    it('fails with zero treasury', async () => {
      await expect(
        emptyProxy.initialize(DEFAULT_START_TIMESTAMP, DEFAULT_END_TIMESTAMP, DEFAULT_MIN_DEPOSIT_AMOUNT, DEFAULT_MAX_DEPOSIT_AMOUNT, DEFAULT_TOTAL_DEPOSIT_LIMIT, DEFAULT_PRICE_PER_ONE_NATIVE_COIN, ethers.ZeroAddress),
      ).to.be.revertedWithCustomError(emptyProxy, "AddressZero");
    });

    it('fails with zero price', async () => {
      await expect(
        emptyProxy.initialize(DEFAULT_START_TIMESTAMP, DEFAULT_END_TIMESTAMP, DEFAULT_MIN_DEPOSIT_AMOUNT, DEFAULT_MAX_DEPOSIT_AMOUNT, DEFAULT_TOTAL_DEPOSIT_LIMIT, ZERO, tresuary),
      ).to.be.revertedWithCustomError(emptyProxy, "AmountZero");
    });

    it('fail if start timestamp is zero', async () => {
      await expect(
        emptyProxy.initialize(ZERO, DEFAULT_END_TIMESTAMP, DEFAULT_MIN_DEPOSIT_AMOUNT, DEFAULT_MAX_DEPOSIT_AMOUNT, DEFAULT_TOTAL_DEPOSIT_LIMIT, DEFAULT_PRICE_PER_ONE_NATIVE_COIN, tresuary),
      ).to.be.revertedWithCustomError(emptyProxy, "AmountZero");
    });    
    
    
    it('fail if end timestamp is zero', async () => {
      await expect(
        emptyProxy.initialize(DEFAULT_START_TIMESTAMP, ZERO, DEFAULT_MIN_DEPOSIT_AMOUNT, DEFAULT_MAX_DEPOSIT_AMOUNT, DEFAULT_TOTAL_DEPOSIT_LIMIT, DEFAULT_PRICE_PER_ONE_NATIVE_COIN, tresuary),
      ).to.be.revertedWithCustomError(emptyProxy, "AmountZero");
    });    
    
    it('fail if start timestamp gr eq end timestamp', async () => {
      await expect(
        emptyProxy.initialize(DEFAULT_END_TIMESTAMP, DEFAULT_END_TIMESTAMP, DEFAULT_MIN_DEPOSIT_AMOUNT, DEFAULT_MAX_DEPOSIT_AMOUNT, DEFAULT_TOTAL_DEPOSIT_LIMIT, DEFAULT_PRICE_PER_ONE_NATIVE_COIN, tresuary),
      ).to.be.revertedWithCustomError(emptyProxy, "InvalidRaiseWindow");
    });    

    it('fail if start timestamp gr end timestamp', async () => {
      await expect(
        emptyProxy.initialize(DEFAULT_END_TIMESTAMP + 1, DEFAULT_END_TIMESTAMP, DEFAULT_MIN_DEPOSIT_AMOUNT, DEFAULT_MAX_DEPOSIT_AMOUNT, DEFAULT_TOTAL_DEPOSIT_LIMIT, DEFAULT_PRICE_PER_ONE_NATIVE_COIN, tresuary),
      ).to.be.revertedWithCustomError(emptyProxy, "InvalidRaiseWindow");
    });

    it('fail if max deposit amount is zero', async () => {
      await expect(
        emptyProxy.initialize(DEFAULT_START_TIMESTAMP, DEFAULT_END_TIMESTAMP, DEFAULT_MIN_DEPOSIT_AMOUNT, 0, DEFAULT_TOTAL_DEPOSIT_LIMIT, DEFAULT_PRICE_PER_ONE_NATIVE_COIN, tresuary),
      ).to.be.revertedWithCustomError(emptyProxy, "AmountZero");
    });
    
    it('fail if max deposit amount it less then min', async () => {
      await expect(
        emptyProxy.initialize(DEFAULT_START_TIMESTAMP, DEFAULT_END_TIMESTAMP, DEFAULT_MIN_DEPOSIT_AMOUNT, DEFAULT_MIN_DEPOSIT_AMOUNT - 1n, DEFAULT_TOTAL_DEPOSIT_LIMIT, DEFAULT_PRICE_PER_ONE_NATIVE_COIN, tresuary),
      ).to.be.revertedWithCustomError(emptyProxy, "InvalidDepositLimits");
    });    
  
    
    it('fail if total deposited amount is zero', async () => {
      await expect(
        emptyProxy.initialize(DEFAULT_START_TIMESTAMP, DEFAULT_END_TIMESTAMP, DEFAULT_MIN_DEPOSIT_AMOUNT, DEFAULT_MAX_DEPOSIT_AMOUNT, 0n, DEFAULT_PRICE_PER_ONE_NATIVE_COIN, tresuary),
      ).to.be.revertedWithCustomError(emptyProxy, "AmountZero");
    });
  });

  describe('Access control', function () {
    it('only owner can setRaiseWindow / setDepositLimits / setTreasury', async function () {
      await expect(proxy.connect(user1).setRaiseWindow(0, 0)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
      await expect(proxy.connect(user1).setDepositLimits(0, 0, 0)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
      await expect(proxy.connect(user1).setTreasury(user1.address)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
    });
  });
});
