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
import { ContractTransactionResponse, TransactionResponse } from 'ethers';
import { provider } from '../../lib/nest-algebra/src/farming/test/shared/provider';

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
    it('only owner can withdrawToTreasury/ setRaiseWindow / setDepositLimits / setTreasury / setTokenPricePerOneNative', async function () {
      await expect(proxy.connect(user1).setRaiseWindow(0, 0)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
      await expect(proxy.connect(user1).setDepositLimits(0, 0, 0)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
      await expect(proxy.connect(user1).setTreasury(user1.address)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
      await expect(proxy.connect(user1).withdrawToTreasury()).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
      await expect(proxy.connect(user1).setTokenPricePerOneNative(1)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
      
    });

    describe("#withdrawToTreasury", async() => {
      it("revert if raise not ended", async() => {
        await expect(proxy.withdrawToTreasury()).to.be.revertedWithCustomError(proxy, "RaiseNotEnded");
        await time.increaseTo(DEFAULT_START_TIMESTAMP)
        await expect(proxy.withdrawToTreasury()).to.be.revertedWithCustomError(proxy, "RaiseNotEnded");
        await time.increaseTo(DEFAULT_END_TIMESTAMP - 1)
        await expect(proxy.withdrawToTreasury()).to.be.revertedWithCustomError(proxy, "RaiseNotEnded");
      })
      it("revert if try withdraw zero", async() => {
        await time.increaseTo(DEFAULT_END_TIMESTAMP + 1)
        await expect(proxy.withdrawToTreasury()).to.be.revertedWithCustomError(proxy, "AmountZero");
      })
    })

    describe("#setTokenPricePerOneNative", async() => {
      it("revert if try setup zero", async() => {
        await expect(proxy.setTokenPricePerOneNative(0)).to.be.revertedWithCustomError(proxy, "AmountZero");
      })
      it("success update price", async() => {
        expect(await proxy.tokenPricePerOneNative()).to.be.eq(DEFAULT_PRICE_PER_ONE_NATIVE_COIN);
        await expect(proxy.setTokenPricePerOneNative(1)).to.be.emit(proxy, 'ExchangeRateUpdated').withArgs(1);
        expect(await proxy.tokenPricePerOneNative()).to.be.eq(1);
        await expect(proxy.setTokenPricePerOneNative(ethers.parseEther('123.4567'))).to.be.emit(proxy, 'ExchangeRateUpdated').withArgs(ethers.parseEther('123.4567'));
        expect(await proxy.tokenPricePerOneNative()).to.be.eq(ethers.parseEther('123.4567'));
      })
    })

    describe("#setTresuary", async() => {
      it("revert if try setup zero", async() => {
        await expect(proxy.setTreasury(ethers.ZeroAddress)).to.be.revertedWithCustomError(proxy, "AddressZero");
      })
      it("success update tresuary", async() => {
        expect(await proxy.treasury()).to.be.eq(tresuary);
        await expect(proxy.setTreasury(user2)).to.be.emit(proxy, 'TreasuryUpdated').withArgs(user2);
        expect(await proxy.treasury()).to.be.eq(user2);
        await expect(proxy.setTreasury(tresuary)).to.be.emit(proxy, 'TreasuryUpdated').withArgs(tresuary);
        expect(await proxy.treasury()).to.be.eq(tresuary);
      })
    })

    describe("#setDepositLimits", async() => {
      it("revert if max gr min", async() => {
        await expect(proxy.setDepositLimits(2, 1, 10)).to.be.revertedWithCustomError(proxy, "InvalidDepositLimits");
      })

      it("revert if max or total is zero", async() => {
        await expect(proxy.setDepositLimits(0, 0, 1)).to.be.revertedWithCustomError(proxy, "AmountZero");
        await expect(proxy.setDepositLimits(0, 1, 0)).to.be.revertedWithCustomError(proxy, "AmountZero");
      })

      it("success update limits", async() => { 
          expect(await proxy.minDepositAmount()).to.be.eq(DEFAULT_MIN_DEPOSIT_AMOUNT);
          expect(await proxy.maxDepositAmount()).to.be.eq(DEFAULT_MAX_DEPOSIT_AMOUNT);
          expect(await proxy.totalDepositCap()).to.be.eq(DEFAULT_TOTAL_DEPOSIT_LIMIT);
          await expect(proxy.setDepositLimits(1, 10, 100)).to.be.emit(proxy, 'DepositLimitsUpdated').withArgs(1, 10, 100);
          expect(await proxy.minDepositAmount()).to.be.eq(1);
          expect(await proxy.maxDepositAmount()).to.be.eq(10);
          expect(await proxy.totalDepositCap()).to.be.eq(100);
      })
    })

    describe("#setRaiseWindow", async() => {
      it("revert if start eq or gr end", async() => {
        await expect(proxy.setRaiseWindow(100, 100)).to.be.revertedWithCustomError(proxy, "InvalidRaiseWindow");
        await expect(proxy.setRaiseWindow(101, 100)).to.be.revertedWithCustomError(proxy, "InvalidRaiseWindow");
      })

      it("revert if start or end is zero", async() => {
        await expect(proxy.setRaiseWindow(0, 100)).to.be.revertedWithCustomError(proxy, "AmountZero");
        await expect(proxy.setRaiseWindow(100, 0)).to.be.revertedWithCustomError(proxy, "AmountZero");
      })

      it("success update raise window", async() => { 
          expect(await proxy.startTimestamp()).to.be.eq(DEFAULT_START_TIMESTAMP);
          expect(await proxy.endTimestamp()).to.be.eq(DEFAULT_END_TIMESTAMP);
          await expect(proxy.setRaiseWindow(1, 100)).to.be.emit(proxy, 'RaiseWindowUpdated').withArgs(1, 100);
          expect(await proxy.startTimestamp()).to.be.eq(1);
          expect(await proxy.endTimestamp()).to.be.eq(100);
          await expect(proxy.setRaiseWindow(DEFAULT_START_TIMESTAMP, DEFAULT_END_TIMESTAMP)).to.be.emit(proxy, 'RaiseWindowUpdated').withArgs(DEFAULT_START_TIMESTAMP, DEFAULT_END_TIMESTAMP);
      })
    })
  });

  describe("#View functions", async() => {
    describe("Before Raise Active", async() => {
      it("isRaiseActive return false", async() => {
        expect(await proxy.isRaiseActive()).to.be.false
      })
      it("maxDeposit return zero", async() => {
        expect(await proxy.maxDeposit(user1)).to.be.eq(ZERO)
        expect(await proxy.maxDeposit(user2)).to.be.eq(ZERO)
        expect(await proxy.maxDeposit(user3)).to.be.eq(ZERO)
      })
    })

    describe("During raise active", async() => {
      beforeEach(async() => {
        await time.increaseTo(DEFAULT_START_TIMESTAMP)
      })
      it("isRaiseActive return true", async() => {
        expect(await proxy.isRaiseActive()).to.be.true
      })
      it("maxDeposit return MAX_PER_USER", async() => {
        expect(await proxy.maxDeposit(user1)).to.be.eq(DEFAULT_MAX_DEPOSIT_AMOUNT)
        expect(await proxy.maxDeposit(user2)).to.be.eq(DEFAULT_MAX_DEPOSIT_AMOUNT)
        expect(await proxy.maxDeposit(user3)).to.be.eq(DEFAULT_MAX_DEPOSIT_AMOUNT)
      })
    })

    describe("After raise end", async() => {
      beforeEach(async() => {
        await time.increaseTo(DEFAULT_END_TIMESTAMP + 1)
      })
      it("isRaiseActive return false", async() => {
        expect(await proxy.isRaiseActive()).to.be.false
      })
      it("maxDeposit return 0", async() => {
        expect(await proxy.maxDeposit(user1)).to.be.eq(ZERO)
        expect(await proxy.maxDeposit(user2)).to.be.eq(ZERO)
        expect(await proxy.maxDeposit(user3)).to.be.eq(ZERO)
      })
    })
  })

  describe("Deposit", async() => {
    it('state before', async() => {
      expect(await proxy.maxDeposit(user1)).to.be.eq(ZERO);
      expect(await proxy.maxDeposit(user2)).to.be.eq(ZERO);
      expect(await proxy.maxDeposit(user3)).to.be.eq(ZERO);
      expect(await ethers.provider.getBalance(proxy)).to.be.eq(ZERO);
      expect(await proxy.totalDeposited()).to.be.eq(ZERO);
      expect(await proxy.userDeposited(user1)).to.be.eq(ZERO);
      expect(await proxy.userDeposited(user2)).to.be.eq(ZERO);
      expect(await proxy.userDeposited(user3)).to.be.eq(ZERO);
      expect(await proxy.userTokensAllocated(user1)).to.be.eq(ZERO);
      expect(await proxy.userTokensAllocated(user2)).to.be.eq(ZERO);
      expect(await proxy.userTokensAllocated(user3)).to.be.eq(ZERO);
    })

    it('revert if raise not active', async() => {
      await expect(proxy.connect(user1).deposit({value: ONE_ETHER})).to.be.revertedWithCustomError(proxy, "RaiseNotActive")
      await time.increaseTo(DEFAULT_END_TIMESTAMP +  1);
      await expect(proxy.connect(user1).deposit({value: ONE_ETHER})).to.be.revertedWithCustomError(proxy, "RaiseNotActive")
    })

    describe("Raise started", async() => {
      beforeEach(async() => {
        await time.increaseTo(DEFAULT_START_TIMESTAMP)
      })
      it('state before', async() => {
          expect(await proxy.maxDeposit(user1)).to.be.eq(DEFAULT_MAX_DEPOSIT_AMOUNT);
          expect(await proxy.maxDeposit(user2)).to.be.eq(DEFAULT_MAX_DEPOSIT_AMOUNT);
          expect(await proxy.maxDeposit(user3)).to.be.eq(DEFAULT_MAX_DEPOSIT_AMOUNT);
          expect(await ethers.provider.getBalance(proxy)).to.be.eq(ZERO);
          expect(await proxy.totalDeposited()).to.be.eq(ZERO);
          expect(await proxy.userDeposited(user1)).to.be.eq(ZERO);
          expect(await proxy.userDeposited(user2)).to.be.eq(ZERO);
          expect(await proxy.userDeposited(user3)).to.be.eq(ZERO);
          expect(await proxy.userTokensAllocated(user1)).to.be.eq(ZERO);
          expect(await proxy.userTokensAllocated(user2)).to.be.eq(ZERO);
          expect(await proxy.userTokensAllocated(user3)).to.be.eq(ZERO);
      })

      it('revert if try deposit zero', async() => {
        await expect(proxy.connect(user1).deposit({value: ZERO})).to.be.revertedWithCustomError(proxy, "AmountZero")
      })

      it('revert if try deposit more max limit', async() => {
        await expect(proxy.connect(user1).deposit({value: DEFAULT_MAX_DEPOSIT_AMOUNT + 1n})).to.be.revertedWithCustomError(proxy, "DepositAboveMax")
      })

      it('revert it try deposit less min first deposit', async() => {
        await expect(proxy.connect(user1).deposit({value: DEFAULT_MIN_DEPOSIT_AMOUNT - 1n})).to.be.revertedWithCustomError(proxy, "DepositBelowMin")
      })
      
      it('revert if try deposit more then max cap rest', async() => {
        await user1.sendTransaction({to:proxy, value: DEFAULT_MAX_DEPOSIT_AMOUNT})
        await user2.sendTransaction({to:proxy, value: DEFAULT_MAX_DEPOSIT_AMOUNT})
        await expect(proxy.connect(user3).deposit({value: DEFAULT_MAX_DEPOSIT_AMOUNT})).to.be.revertedWithCustomError(proxy, "DepositAboveMax")
        await expect(proxy.connect(user3).deposit({value: DEFAULT_TOTAL_DEPOSIT_LIMIT - DEFAULT_MAX_DEPOSIT_AMOUNT - DEFAULT_MAX_DEPOSIT_AMOUNT + 1n})).to.be.revertedWithCustomError(proxy, "DepositAboveMax")
      
        await user3.sendTransaction({to:proxy, value: ethers.parseEther('99.9')})

        await expect(proxy.connect(deployer).deposit({value: ethers.parseEther('0.1') + 1n})).to.be.revertedWithCustomError(proxy, "DepositAboveMax")
      })

      it('revert if try deposit more max limit by two tx', async() => {
        await user1.sendTransaction({to:proxy, value: DEFAULT_MAX_DEPOSIT_AMOUNT - 1n})
        await expect(proxy.connect(user1).deposit({value: 2n})).to.be.revertedWithCustomError(proxy, "DepositAboveMax")
      })

      describe("success deposit from user1 deposit amount", async() => {
        let depositTx: ContractTransactionResponse;
        let depositedAmount = ethers.parseEther('2');
        let expectTokensAmountOut = ethers.parseEther('21')

        beforeEach(async() => {
          depositTx = await proxy.connect(user1).deposit({value: ethers.parseEther('2')});
        })

        it("maxDeposit return rest", async() => {
          expect(await proxy.maxDeposit(user1)).to.be.eq(DEFAULT_MAX_DEPOSIT_AMOUNT - ethers.parseEther('2'))
          expect(await proxy.maxDeposit(user1)).to.be.eq(ethers.parseEther('198'))

          expect(await proxy.maxDeposit(user2)).to.be.eq(DEFAULT_MAX_DEPOSIT_AMOUNT)
          expect(await proxy.maxDeposit(user3)).to.be.eq(DEFAULT_MAX_DEPOSIT_AMOUNT)
        })

        it('success calculate expect tokensOut', async() => {
          expect(expectTokensAmountOut).to.be.eq(depositedAmount * DEFAULT_PRICE_PER_ONE_NATIVE_COIN / ethers.parseEther('1'))
          expect(await proxy.userTokensAllocated(user1)).to.be.eq(expectTokensAmountOut)
        })
        
        it('success transfer balance', async() => {
          expect(await ethers.provider.getBalance(proxy)).to.be.eq(depositedAmount)
        })

        it('success update state', async()=> {
          expect(await proxy.userTokensAllocated(user1)).to.be.eq(expectTokensAmountOut)
          expect(await proxy.userDeposited(user1)).to.be.eq(depositedAmount)
          expect(await proxy.userDeposited(user2)).to.be.eq(ZERO)
          expect(await proxy.userDeposited(user3)).to.be.eq(ZERO)
          expect(await proxy.userTokensAllocated(user1)).to.be.eq(expectTokensAmountOut)
          expect(await proxy.userTokensAllocated(user2)).to.be.eq(ZERO)
          expect(await proxy.userTokensAllocated(user3)).to.be.eq(ZERO)
          expect(await proxy.totalDeposited()).to.be.eq(depositedAmount)
        })
        
        it("second min deposit not limited by min limit", async() => {
          await expect(proxy.connect(user1).deposit({value: 1n})).to.be.not.reverted
        })

        it("success emit event", async() => {
          await expect(depositTx).to.be.emit(proxy, "Deposited").withArgs(user1, depositedAmount, expectTokensAmountOut)
        })

        describe("Success deposit from first user rest and max amount from second user by direct transfer", async() => {
          let secondDepositTx: TransactionResponse;
          let expectPerMax:bigint;

          beforeEach(async() => {
            expectPerMax = ethers.parseEther('200') * DEFAULT_PRICE_PER_ONE_NATIVE_COIN / ethers.parseEther('1')
            await user1.sendTransaction({to:proxy, value: DEFAULT_MAX_DEPOSIT_AMOUNT - depositedAmount});
            secondDepositTx = await user2.sendTransaction({to: proxy, value: DEFAULT_MAX_DEPOSIT_AMOUNT});
          })

          it("maxDeposit return correct", async() => {
            expect(await proxy.maxDeposit(user1)).to.be.eq(ZERO)
            expect(await proxy.maxDeposit(user2)).to.be.eq(ZERO)
            expect(await proxy.maxDeposit(user3)).to.be.eq(ethers.parseEther('100'))
          })

          it("state after", async() => {
            expect(await proxy.userDeposited(user1)).to.be.eq(ethers.parseEther('200'))
            expect(await proxy.userDeposited(user2)).to.be.eq(ethers.parseEther('200'))
            expect(await proxy.userDeposited(user3)).to.be.eq(ZERO)
            expect(await proxy.userTokensAllocated(user1)).to.be.eq(expectPerMax)
            expect(await proxy.userTokensAllocated(user2)).to.be.eq(expectPerMax)
            expect(await proxy.userTokensAllocated(user3)).to.be.eq(ZERO)
            expect(await proxy.totalDeposited()).to.be.eq(ethers.parseEther('400'))
          })

          it("success change balances", async() => {
            expect(await provider.getBalance(proxy)).to.be.eq(ethers.parseEther('400'))
          })

          it("success emit events", async() => {
            await expect(secondDepositTx).to.be.emit(proxy, "Deposited").withArgs(user2, ethers.parseEther('200'), expectPerMax)
          })

          describe("deposit from user3", async() => {
            let thirdDepositTx: TransactionResponse;
            let expectAmountOut: bigint;

            beforeEach(async() => {
              expectAmountOut = ethers.parseEther('50.5') * DEFAULT_PRICE_PER_ONE_NATIVE_COIN / ethers.parseEther('1');
              thirdDepositTx = await proxy.connect(user3).deposit({value:ethers.parseEther('50.5')});
            })

            it("maxDeposit return correct", async() => {
              expect(await proxy.maxDeposit(user1)).to.be.eq(ZERO)
              expect(await proxy.maxDeposit(user2)).to.be.eq(ZERO)
              expect(await proxy.maxDeposit(user3)).to.be.eq(ethers.parseEther('49.5'))
            })

            it("state after", async() => {
              expect(await proxy.userDeposited(user1)).to.be.eq(ethers.parseEther('200'))
              expect(await proxy.userDeposited(user2)).to.be.eq(ethers.parseEther('200'))
              expect(await proxy.userDeposited(user3)).to.be.eq(ethers.parseEther('50.5'))
              expect(await proxy.userTokensAllocated(user1)).to.be.eq(expectPerMax)
              expect(await proxy.userTokensAllocated(user2)).to.be.eq(expectPerMax)
              expect(await proxy.userTokensAllocated(user3)).to.be.eq(expectAmountOut)
              expect(await proxy.totalDeposited()).to.be.eq(ethers.parseEther('450.5'))
            })

            it("success change balances", async() => {
              expect(await provider.getBalance(proxy)).to.be.eq(ethers.parseEther('450.5'))
            })

            it("success emit events", async() => {
              await expect(thirdDepositTx).to.be.emit(proxy, "Deposited").withArgs(user3, ethers.parseEther('50.5'), expectAmountOut)
            })

            describe("Deposit min from user3", async() => {
                let thirdDepositTx: TransactionResponse;

                beforeEach(async() => {
                  thirdDepositTx = await proxy.connect(user3).deposit({value:ethers.parseEther('0.1')});
                })

                it("maxDeposit return correct", async() => {
                  expect(await proxy.maxDeposit(user1)).to.be.eq(ZERO)
                  expect(await proxy.maxDeposit(user2)).to.be.eq(ZERO)
                  expect(await proxy.maxDeposit(user3)).to.be.eq(ethers.parseEther('49.4'))
                })

                it("state after", async() => {
                  expect(await proxy.userDeposited(user1)).to.be.eq(ethers.parseEther('200'))
                  expect(await proxy.userDeposited(user2)).to.be.eq(ethers.parseEther('200'))
                  expect(await proxy.userDeposited(user3)).to.be.eq(ethers.parseEther('50.6'))
                  expect(await proxy.userTokensAllocated(user1)).to.be.eq(expectPerMax)
                  expect(await proxy.userTokensAllocated(user2)).to.be.eq(expectPerMax)
                  expect(await proxy.userTokensAllocated(user3)).to.be.eq(expectAmountOut + ethers.parseEther('0.1') * DEFAULT_PRICE_PER_ONE_NATIVE_COIN / ethers.parseEther('1'))
                  expect(await proxy.totalDeposited()).to.be.eq(ethers.parseEther('450.6'))
                })

                it("success change balances", async() => {
                  expect(await provider.getBalance(proxy)).to.be.eq(ethers.parseEther('450.6'))
                })

                it("success emit events", async() => {
                  await expect(thirdDepositTx).to.be.emit(proxy, "Deposited").withArgs(user3, ethers.parseEther('0.1'), ethers.parseEther('0.1') * DEFAULT_PRICE_PER_ONE_NATIVE_COIN / ethers.parseEther('1'))
                })
                
                it('state after deposit alls', async() => {
                  await proxy.connect(user3).deposit({value: ethers.parseEther('49.4')})
                  expect(await proxy.maxDeposit(user1)).to.be.eq(ZERO)
                  expect(await proxy.maxDeposit(user2)).to.be.eq(ZERO)
                  expect(await proxy.maxDeposit(user3)).to.be.eq(ZERO)
                  expect(await proxy.maxDeposit(deployer)).to.be.eq(ZERO)
                  expect(await proxy.totalDeposited()).to.be.eq(ethers.parseEther('500'))
                })

                describe("withdrawToTresuary", async() => {
                  beforeEach(async() => {
                    await time.increaseTo(DEFAULT_END_TIMESTAMP + 1)
                  })

                  it("final state after all deposits", async() => { 
                    expect(await proxy.userDeposited(user1)).to.be.eq(ethers.parseEther('200'))
                    expect(await proxy.userDeposited(user2)).to.be.eq(ethers.parseEther('200'))
                    expect(await proxy.userDeposited(user3)).to.be.eq(ethers.parseEther('50.6'))
                    expect(await proxy.userTokensAllocated(user1)).to.be.eq(ethers.parseEther('2100'))
                    expect(await proxy.userTokensAllocated(user2)).to.be.eq(ethers.parseEther('2100'))
                    expect(await proxy.userTokensAllocated(user3)).to.be.eq(ethers.parseEther('531.3'))
                    expect(await proxy.totalDeposited()).to.be.eq(ethers.parseEther('450.6'))
                    expect(await ethers.provider.getBalance(proxy)).to.be.eq(ethers.parseEther('450.6'))
                    expect(await proxy.isRaiseActive()).to.be.false;
                    expect(await proxy.maxDeposit(user1)).to.be.eq(0)
                    expect(await proxy.maxDeposit(user2)).to.be.eq(0)
                    expect(await proxy.maxDeposit(user3)).to.be.eq(0)

                  })

                  it("success withdrtawToTresaurty", async() => {
                    let balanceBefore = await ethers.provider.getBalance(tresuary);
                    let deposited =  await proxy.totalDeposited();

                    await expect(proxy.withdrawToTreasury()).to.be.emit(proxy, "TreasuryWithdrawn").withArgs(tresuary, deposited)

                    let balanceAfter = await ethers.provider.getBalance(tresuary);
                    expect(balanceBefore + deposited).to.be.eq(balanceAfter)
                    expect(await provider.getBalance(proxy)).to.be.eq(ZERO);

                    await expect(proxy.withdrawToTreasury()).to.be.revertedWithCustomError(proxy, "AmountZero")
                  })
                })
            })
          })
        })
      })
    })
  })
});
