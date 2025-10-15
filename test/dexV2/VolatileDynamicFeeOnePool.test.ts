import {
  loadFixture,
  time,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import {
  ERC20Mock,
  FeesVaultFactoryUpgradeable,
  FeesVaultUpgradeable,
  Pair,
  PairFactoryUpgradeable,
  PairFactoryUpgradeable__factory,
  VolatileDynamicFeeOnePool,
} from "../../typechain-types";
import completeFixture, {
  CoreFixtureDeployed,
  deployERC20MockToken,
  SignersList,
} from "../utils/coreFixture";
import { ERRORS } from "../utils/constants";

describe("VolatileDynamicFeeOnePool Contract", function () {
  let signers: SignersList;
  let pairFactoryFactory: PairFactoryUpgradeable__factory;
  let pairFactory: PairFactoryUpgradeable;
  let feesVaultFactory: FeesVaultFactoryUpgradeable;
  let deployed: CoreFixtureDeployed;
  let tokenTK18: ERC20Mock;
  let tokenTK6: ERC20Mock;

  let Implementation: VolatileDynamicFeeOnePool;
  let Instance: VolatileDynamicFeeOnePool;
  let pairVolatily: Pair;
  const PRECISION = 10000n;

  beforeEach(async function () {
    deployed = await loadFixture(completeFixture);
    signers = deployed.signers;

    pairFactoryFactory = await ethers.getContractFactory(
      "PairFactoryUpgradeable",
    );
    pairFactory = deployed.v2PairFactory;
    feesVaultFactory = deployed.feesVaultFactory;

    tokenTK18 = await deployERC20MockToken(
      deployed.signers.deployer,
      "TK18",
      "TK18",
      18,
    );
    tokenTK6 = await deployERC20MockToken(
      deployed.signers.deployer,
      "TK6",
      "TK6",
      6,
    );

    await feesVaultFactory.grantRole(
      await feesVaultFactory.WHITELISTED_CREATOR_ROLE(),
      pairFactory.target,
    );

    Implementation = await ethers.deployContract("VolatileDynamicFeeOnePool");
    let target = (
      await ethers.deployContract("TransparentUpgradeableProxy", [
        Implementation,
        signers.proxyAdmin,
        "0x",
      ])
    ).target;
    Instance = await ethers.getContractAt("VolatileDynamicFeeOnePool", target);

    await deployed.v2PairFactory.connect(signers.deployer).createPair(tokenTK18.target, tokenTK6.target, false);

    pairVolatily = await ethers.getContractAt('Pair', await pairFactory.getPair(tokenTK18.target, tokenTK6.target, false));

  });

  describe("Initialize", async () => {
    describe("fail if", async () => {
      it("already initialized", async () => {
        await Instance.initialize(pairVolatily, 0, PRECISION, 0, 1, 1)

        await expect(Instance.initialize(pairVolatily, 0, PRECISION, 0, 1, 1)).to.be.revertedWith("Initializable: contract is already initialized")
      });

      it("call on Implementation", async () => {
        await expect(Implementation.initialize(pairVolatily, 0, PRECISION, 0, 1, 1)).to.be.revertedWith("Initializable: contract is already initialized")
      });

      it("startFeePercentage is more then 100%", async () => {
         await expect(Instance.initialize(pairVolatily, 0, PRECISION + 1n, 0, 1, 1)).to.be.revertedWithCustomError(Instance, "InvalidConfiguration")
      });

      it("finalFeePercentage is less or equal startFeePercentage", async () => {
         await expect(Instance.initialize(pairVolatily, 0, PRECISION -1n , PRECISION, 1, 1)).to.be.revertedWithCustomError(Instance, "InvalidConfiguration")
      });

      it("decreaseInterval is zero", async () => {
         await expect(Instance.initialize(pairVolatily, 0, PRECISION, 0, 0, 1)).to.be.revertedWithCustomError(Instance, "InvalidConfiguration")
      });

      it("decreaseStepBps is zero", async () => {
         await expect(Instance.initialize(pairVolatily, 0, PRECISION, 0, 1, 0)).to.be.revertedWithCustomError(Instance, "InvalidConfiguration")
      });

      it("decreaseStepBps more then 100%", async () => {
         await expect(Instance.initialize(pairVolatily, 0, PRECISION, 0, 1, PRECISION + 1n)).to.be.revertedWithCustomError(Instance, "InvalidConfiguration")
      });

      it("pair is zero", async () => {
         await expect(Instance.initialize(ethers.ZeroAddress, 0, PRECISION, 0, 1, 1n)).to.be.revertedWithCustomError(Instance, "AddressZero")
      });
    });
  });

  describe("#initialized", async() => {
    let START_TIMESTAMP = 0n;
    let START_FEE_PERCENTAGE = 5_000n;
    let FINAL_FEE_PERCENTAGE = 100n;
    let DECREASE_INTERVAL = 60n;
    let DECREASE_STEP_BPS = 100n;

    beforeEach(async() => {
        START_TIMESTAMP = BigInt(await time.latest()) + 3600n;
        await Instance.initialize(pairVolatily, START_TIMESTAMP, START_FEE_PERCENTAGE, FINAL_FEE_PERCENTAGE, DECREASE_INTERVAL, DECREASE_STEP_BPS)
    })

    describe("success setup", async() => {
        it("pair", async() => {
            expect(await Instance.pair()).to.be.eq(pairVolatily);
        })

        it("decreaseInterval", async() => {
            expect(await Instance.decreaseInterval()).to.be.eq(DECREASE_INTERVAL);
        })

        it("decreaseStepBps", async() => {
            expect(await Instance.decreaseStepBps()).to.be.eq(DECREASE_STEP_BPS);
        })

        it("startFeePercentage", async() => {
            expect(await Instance.startFeePercentage()).to.be.eq(START_FEE_PERCENTAGE);
        })

        it("finalFeePercentage", async() => {
            expect(await Instance.finalFeePercentage()).to.be.eq(FINAL_FEE_PERCENTAGE);
        })

        it("startTimestamp", async() => {
            expect(await Instance.startTimestamp()).to.be.eq(START_TIMESTAMP);
        })
    })

    describe("setStartTimestamp", async() => {
      it("fail if caller not owner", async() => {
        await expect(Instance.connect(signers.otherUser1).setStartTimestamp(1)).to.be.revertedWith(ERRORS.Ownable.NotOwner)
      })

      it("success update startTimestamp", async() => {
        expect(await Instance.startTimestamp()).to.be.eq(START_TIMESTAMP);

        await expect(Instance.connect(signers.deployer).setStartTimestamp(100)).to.be.emit(Instance, "SetStartTimestamp").withArgs(100)

        expect(await Instance.startTimestamp()).to.be.eq(100);

        let newTimestamp  = await time.latest() + 36000;
        await expect(Instance.connect(signers.deployer).setStartTimestamp(newTimestamp)).to.be.emit(Instance, "SetStartTimestamp").withArgs(newTimestamp)
        
        expect(await Instance.startTimestamp()).to.be.eq(newTimestamp);
      })
    })

    describe("#getFee", async() => {
      it("revert if try get fee for not expect pair", async() => {
        await expect(Instance.getFee(signers.otherUser2)).to.be.reverted
      })
    })
    describe("calculate", async () => {
        it("corn case", async() => {
          expect(await Instance.calculate(
                1_002_940n,  // start + 49*60s
                1_000_000n,
                5000,    
                100,    
                60,    
                100
              )).to.be.eq(100);
          expect(await Instance.calculate(
                1_002_939n,  // start + 49*60s
                1_000_000n,
                5000,    
                100,    
                60,    
                100
              )).to.be.eq(200);
          expect(await Instance.calculate(
                1_002_941n,  // start + 49*60s
                1_000_000n,
                5000,    
                100,    
                60,    
                100
              )).to.be.eq(100);
          expect(await Instance.calculate(
                1_003_000n,  // start + 50*60s
                1_000_000n,
                5000,    
                100,    
                60,    
                100
              )).to.be.eq(100);

          expect(await Instance.calculate(
                1_003_000n,  // start + 50*60s
                1_000_000n,
                5100,    
                50,    
                60,    
                100
              )).to.be.eq(100);
        })

        it("returns fee percentage correct based on time", async function () {
            const now = BigInt(await time.latest());

            const cases: { time: bigint; expectBps: bigint }[] = [
              { time: 1n,     expectBps: 5_000n },
              { time: 1800n,  expectBps: 5_000n },
              { time: 3500n,  expectBps: 5_000n },
              { time: 3600n,  expectBps: 5_000n }, // exactly at start
              { time: 3660n,  expectBps: 4_900n }, // +1 step
              { time: 3720n,  expectBps: 4_800n }, // +2 steps
              { time: 3600n + 47n*60n,        expectBps: 300n }, // 47 -> 30.00%
              { time: 3600n + 48n*60n - 1n,   expectBps: 200n }, // 1 second before -> ще 20.00%
              { time: 3600n + 49n*60n,        expectBps: 100n }, // -> 1.00% (final)
              { time: 3600n + 50n*60n,        expectBps: 100n }, // final
              { time: 3600n + 49n*60n + 3600n,expectBps: 100n }, // final
            ];

            for (const c of cases) {
              const ts = now + c.time;

              await time.increaseTo(ts);

              const fee1 = await Instance.calculate(
                ts,             
                START_TIMESTAMP,        
                START_FEE_PERCENTAGE,    
                FINAL_FEE_PERCENTAGE,    
                DECREASE_INTERVAL,    
                DECREASE_STEP_BPS         
              );
              expect(fee1).to.equal(c.expectBps);

              const fee2 = await Instance.getFee(
                pairVolatily
              );
              expect(fee2.fee).to.equal(c.expectBps);
              expect(fee2.success).to.be.true
              
              // check if not setup
              expect(await pairFactory.getCustomVolatileDynamicFeeModule(pairVolatily)).to.be.eq(ethers.ZeroAddress)
              expect(await pairFactory.getFee(pairVolatily, false)).to.be.eq(await pairFactory.volatileFee());

              await pairFactory.setCustomVolatileDynamicFeeModule(pairVolatily, Instance);

              expect(await pairFactory.getCustomVolatileDynamicFeeModule(pairVolatily)).to.be.eq(Instance)
              expect(await pairFactory.getFee(pairVolatily, false)).to.be.eq(c.expectBps);

              await pairFactory.setCustomVolatileDynamicFeeModule(pairVolatily, ethers.ZeroAddress);
              
              expect(await pairFactory.getCustomVolatileDynamicFeeModule(pairVolatily)).to.be.eq(ethers.ZeroAddress)
              expect(await pairFactory.getFee(pairVolatily, false)).to.be.eq(await pairFactory.volatileFee());
            }

        })

        it("return start fee percentage if start timestamp is zero", async () => {
            expect(await Instance.calculate(100, 100, START_FEE_PERCENTAGE, 0, 0, 0)).to.be.eq(START_FEE_PERCENTAGE)
        });

        it("return start fee percentage if start timestamp not achive", async () => {
            expect(await Instance.calculate(100, 101, START_FEE_PERCENTAGE, FINAL_FEE_PERCENTAGE, DECREASE_INTERVAL, DECREASE_STEP_BPS)).to.be.eq(START_FEE_PERCENTAGE)
        });

        it("return start fee percentage if first interval not pass", async () => {
            expect(await Instance.calculate(109, 100, START_FEE_PERCENTAGE, FINAL_FEE_PERCENTAGE, 10, DECREASE_STEP_BPS)).to.be.eq(START_FEE_PERCENTAGE)
        });

        it("return start fee percentage - 1 bps step if first interval pass", async () => {
            expect(await Instance.calculate(110, 100, START_FEE_PERCENTAGE, FINAL_FEE_PERCENTAGE, 10, DECREASE_STEP_BPS)).to.be.eq(START_FEE_PERCENTAGE - DECREASE_STEP_BPS)
        });

        it("return start fee percentage - 1 bps step if second not achive", async () => {
            expect(await Instance.calculate(119, 100, START_FEE_PERCENTAGE, FINAL_FEE_PERCENTAGE, 10, DECREASE_STEP_BPS)).to.be.eq(START_FEE_PERCENTAGE - DECREASE_STEP_BPS)
        });

        it("return start fee percentage - 2 bps step if second not achive", async () => {
            expect(await Instance.calculate(120, 100, START_FEE_PERCENTAGE, FINAL_FEE_PERCENTAGE, 10, DECREASE_STEP_BPS)).to.be.eq(START_FEE_PERCENTAGE - DECREASE_STEP_BPS - DECREASE_STEP_BPS);
           expect(await Instance.calculate(121, 100, START_FEE_PERCENTAGE, FINAL_FEE_PERCENTAGE, 10, DECREASE_STEP_BPS)).to.be.eq(START_FEE_PERCENTAGE - DECREASE_STEP_BPS - DECREASE_STEP_BPS);
        });

        it("return final fee percentage, if pass last steps", async() => {
            let t = START_FEE_PERCENTAGE - FINAL_FEE_PERCENTAGE;
            let d = t/DECREASE_STEP_BPS;

            expect(await Instance.calculate(100n + DECREASE_INTERVAL * d, 100, START_FEE_PERCENTAGE, FINAL_FEE_PERCENTAGE, DECREASE_INTERVAL, DECREASE_STEP_BPS)).to.be.eq(FINAL_FEE_PERCENTAGE);
        })
    });

    describe("isEnable", async () => {
        it("return always true", async() => {
            expect(await Instance.isEnable()).to.be.true;
            await time.increase(86000);
            expect(await Instance.isEnable()).to.be.true;
            await time.increase(8006000);
            expect(await Instance.isEnable()).to.be.true;
        })
    });

  })
});
