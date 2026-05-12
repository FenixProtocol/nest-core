import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { WEEK } from '../utils/constants';

import { loadFixture, time } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { BribeUpgradeable, ERC20Mock } from '../../typechain-types';
import completeFixture, { CoreFixtureDeployed, SignersList, deployERC20MockToken } from '../utils/coreFixture';

describe('BribeUpgradeable - Reward Precision Fix', function () {
    let signers: SignersList;
    let deployed: CoreFixtureDeployed;
    let internalBribe: BribeUpgradeable;

    let tokenBTC: ERC20Mock; // 8 decimals (like BTC)
    let token18: ERC20Mock; // 18 decimals (standard)
    let token6: ERC20Mock; // 6 decimals (like USDC)

    let pair: string;

    beforeEach(async function () {
        deployed = await loadFixture(completeFixture);
        signers = deployed.signers;

        tokenBTC = await deployERC20MockToken(signers.deployer, 'Wrapped BTC', 'WBTC', 8);
        token18 = await deployERC20MockToken(signers.deployer, 'Token18', 'T18', 18);
        token6 = await deployERC20MockToken(signers.deployer, 'USDC', 'USDC', 6);

        await deployed.v2PairFactory.createPair(token18.target, tokenBTC.target, false);
        pair = await deployed.v2PairFactory.getPair(token18.target, tokenBTC.target, false);

        await deployed.voter.createV2Gauge(pair);
        const gauge = await deployed.voter.poolToGauge(pair);
        const gaugeState = await deployed.voter.gaugesState(gauge);
        internalBribe = await ethers.getContractAt('BribeUpgradeable', gaugeState.internalBribe);

        await tokenBTC.approve(internalBribe.target, ethers.MaxUint256);
        await token18.approve(internalBribe.target, ethers.MaxUint256);
        await token6.approve(internalBribe.target, ethers.MaxUint256);

        await deployed.fenix.approve(deployed.votingEscrow.target, ethers.MaxUint256);
    });

    async function advanceOneEpoch() {
        await time.increase(WEEK);
        await deployed.voter.distributeAll();
    }

    describe('Low-decimal token precision (core bug scenario)', function () {
        it('should correctly calculate rewards for 8-decimal token with large total supply', async function () {
            // 0.01 BTC = 1_000_000 raw (1e6) as bribe
            const btcBribeAmount = 1_000_000n;
            await tokenBTC.mint(signers.deployer.address, btcBribeAmount);
            await internalBribe.notifyRewardAmount(tokenBTC.target, btcBribeAmount);

            // Create large veNFT positions: 5M NEST each → 10M total supply
            await deployed.votingEscrow.createLockFor(ethers.parseEther('5000000'), 0, signers.otherUser1.address, false, true, 0);
            await deployed.votingEscrow.createLockFor(ethers.parseEther('5000000'), 0, signers.otherUser2.address, false, true, 0);

            // Vote for the pool
            await deployed.voter.connect(signers.otherUser1).vote(1, [pair], [100]);
            await deployed.voter.connect(signers.otherUser2).vote(2, [pair], [100]);

            await advanceOneEpoch();

            // Despite rewardPerToken being 0, earned() should return correct non-zero values
            const earned1 = await internalBribe['earned(address,address)'](signers.otherUser1.address, tokenBTC.target);
            const earned2 = await internalBribe['earned(address,address)'](signers.otherUser2.address, tokenBTC.target);

            expect(earned1).to.be.gt(0, 'User 1 should earn non-zero BTC rewards');
            expect(earned2).to.be.gt(0, 'User 2 should earn non-zero BTC rewards');

            // Both users have equal voting power, so they should earn equal rewards
            expect(earned1).to.be.eq(earned2, 'Equal voters should earn equal rewards');

            // Total distributed should not exceed the bribe amount
            expect(earned1 + earned2).to.be.lte(btcBribeAmount, 'Total earned should not exceed bribe amount');

            // Each user should get approximately half (within rounding)
            const expectedPerUser = btcBribeAmount / 2n;
            expect(earned1).to.be.eq(expectedPerUser);
        });

        it('should handle 6-decimal token (USDC) with large total supply', async function () {
            // 1 USDC = 1_000_000 raw (1e6)
            const usdcBribeAmount = 1_000_000n;
            await token6.mint(signers.deployer.address, usdcBribeAmount);
            await deployed.bribeFactory['addRewards(address,address[])'](token6.target, [internalBribe.target]);
            await internalBribe.notifyRewardAmount(token6.target, usdcBribeAmount);

            await deployed.votingEscrow.createLockFor(ethers.parseEther('5000000'), 0, signers.otherUser1.address, false, true, 0);
            await deployed.votingEscrow.createLockFor(ethers.parseEther('5000000'), 0, signers.otherUser2.address, false, true, 0);

            await deployed.voter.connect(signers.otherUser1).vote(1, [pair], [100]);
            await deployed.voter.connect(signers.otherUser2).vote(2, [pair], [100]);

            await advanceOneEpoch();

            const earned1 = await internalBribe['earned(address,address)'](signers.otherUser1.address, token6.target);
            const earned2 = await internalBribe['earned(address,address)'](signers.otherUser2.address, token6.target);

            expect(earned1).to.be.gt(0, 'User 1 should earn non-zero USDC rewards');
            expect(earned1).to.be.eq(earned2);
            expect(earned1 + earned2).to.be.lte(usdcBribeAmount);
        });

        it('should correctly calculate rewards for very small BTC bribe amounts', async function () {
            // 0.00001 BTC = 1000 raw (1e3) — tiny bribe
            const btcBribeAmount = 1000n;
            await tokenBTC.mint(signers.deployer.address, btcBribeAmount);
            await internalBribe.notifyRewardAmount(tokenBTC.target, btcBribeAmount);

            // 1M NEST each → 2M total
            await deployed.votingEscrow.createLockFor(ethers.parseEther('1000000'), 0, signers.otherUser1.address, false, true, 0);
            await deployed.votingEscrow.createLockFor(ethers.parseEther('1000000'), 0, signers.otherUser2.address, false, true, 0);

            await deployed.voter.connect(signers.otherUser1).vote(1, [pair], [100]);
            await deployed.voter.connect(signers.otherUser2).vote(2, [pair], [100]);

            await advanceOneEpoch();

            const earned1 = await internalBribe['earned(address,address)'](signers.otherUser1.address, tokenBTC.target);
            expect(earned1).to.be.eq(500n, 'Each user should get half of tiny bribe');
        });
    });

    describe('18-decimal token precision (regression)', function () {
        it('should still correctly calculate rewards for standard 18-decimal tokens', async function () {
            const bribeAmount = ethers.parseEther('100');
            await token18.mint(signers.deployer.address, bribeAmount);
            await internalBribe.notifyRewardAmount(token18.target, bribeAmount);

            await deployed.votingEscrow.createLockFor(ethers.parseEther('1'), 0, signers.otherUser1.address, false, true, 0);
            await deployed.votingEscrow.createLockFor(ethers.parseEther('1'), 0, signers.otherUser2.address, false, true, 0);
            await deployed.votingEscrow.createLockFor(ethers.parseEther('2'), 0, signers.otherUser3.address, false, true, 0);

            await deployed.voter.connect(signers.otherUser1).vote(1, [pair], [100]);
            await deployed.voter.connect(signers.otherUser2).vote(2, [pair], [100]);
            await deployed.voter.connect(signers.otherUser3).vote(3, [pair], [100]);

            await advanceOneEpoch();

            const earned1 = await internalBribe['earned(address,address)'](signers.otherUser1.address, token18.target);
            const earned2 = await internalBribe['earned(address,address)'](signers.otherUser2.address, token18.target);
            const earned3 = await internalBribe['earned(address,address)'](signers.otherUser3.address, token18.target);

            // 1/4, 1/4, 2/4 of 100 tokens
            expect(earned1).to.be.eq(ethers.parseEther('25'));
            expect(earned2).to.be.eq(ethers.parseEther('25'));
            expect(earned3).to.be.eq(ethers.parseEther('50'));
        });
    });

    describe('Proportional distribution', function () {
        it('should distribute rewards proportionally with unequal voting power', async function () {
            // 1 BTC = 1e8 raw
            const btcBribeAmount = 100_000_000n;
            await tokenBTC.mint(signers.deployer.address, btcBribeAmount);
            await internalBribe.notifyRewardAmount(tokenBTC.target, btcBribeAmount);

            // User1: 1M NEST, User2: 4M NEST → ratio 1:4
            await deployed.votingEscrow.createLockFor(ethers.parseEther('1000000'), 0, signers.otherUser1.address, false, true, 0);
            await deployed.votingEscrow.createLockFor(ethers.parseEther('4000000'), 0, signers.otherUser2.address, false, true, 0);

            await deployed.voter.connect(signers.otherUser1).vote(1, [pair], [100]);
            await deployed.voter.connect(signers.otherUser2).vote(2, [pair], [100]);

            await advanceOneEpoch();

            const earned1 = await internalBribe['earned(address,address)'](signers.otherUser1.address, tokenBTC.target);
            const earned2 = await internalBribe['earned(address,address)'](signers.otherUser2.address, tokenBTC.target);

            // User1 gets 1/5 = 20_000_000, User2 gets 4/5 = 80_000_000
            expect(earned1).to.be.eq(20_000_000n);
            expect(earned2).to.be.eq(80_000_000n);
            expect(earned1 + earned2).to.be.eq(btcBribeAmount);
        });

        it('should correctly distribute when single voter has all votes', async function () {
            const btcBribeAmount = 50_000_000n; // 0.5 BTC
            await tokenBTC.mint(signers.deployer.address, btcBribeAmount);
            await internalBribe.notifyRewardAmount(tokenBTC.target, btcBribeAmount);

            await deployed.votingEscrow.createLockFor(ethers.parseEther('10000000'), 0, signers.otherUser1.address, false, true, 0);
            await deployed.voter.connect(signers.otherUser1).vote(1, [pair], [100]);

            await advanceOneEpoch();

            const earned = await internalBribe['earned(address,address)'](signers.otherUser1.address, tokenBTC.target);
            expect(earned).to.be.eq(btcBribeAmount, 'Single voter should get entire bribe');
        });
    });

    describe('Claim flow', function () {
        it('should allow users to claim low-decimal token rewards', async function () {
            const btcBribeAmount = 10_000_000n; // 0.1 BTC
            await tokenBTC.mint(signers.deployer.address, btcBribeAmount);
            await internalBribe.notifyRewardAmount(tokenBTC.target, btcBribeAmount);

            await deployed.votingEscrow.createLockFor(ethers.parseEther('5000000'), 0, signers.otherUser1.address, false, true, 0);
            await deployed.votingEscrow.createLockFor(ethers.parseEther('5000000'), 0, signers.otherUser2.address, false, true, 0);

            await deployed.voter.connect(signers.otherUser1).vote(1, [pair], [100]);
            await deployed.voter.connect(signers.otherUser2).vote(2, [pair], [100]);

            await advanceOneEpoch();

            const balanceBefore1 = await tokenBTC.balanceOf(signers.otherUser1.address);
            const balanceBefore2 = await tokenBTC.balanceOf(signers.otherUser2.address);

            await internalBribe.connect(signers.otherUser1)['getReward(address[])']([tokenBTC.target]);
            await internalBribe.connect(signers.otherUser2)['getReward(address[])']([tokenBTC.target]);

            const balanceAfter1 = await tokenBTC.balanceOf(signers.otherUser1.address);
            const balanceAfter2 = await tokenBTC.balanceOf(signers.otherUser2.address);

            const claimed1 = balanceAfter1 - balanceBefore1;
            const claimed2 = balanceAfter2 - balanceBefore2;

            expect(claimed1).to.be.eq(btcBribeAmount / 2n);
            expect(claimed2).to.be.eq(btcBribeAmount / 2n);
        });
    });

    describe('Multi-epoch accumulation', function () {
        it('should accumulate rewards across multiple epochs for low-decimal tokens', async function () {
            await deployed.votingEscrow.createLockFor(ethers.parseEther('5000000'), 0, signers.otherUser1.address, false, true, 0);

            // Epoch 1: deposit bribe and vote
            const btcBribe1 = 10_000_000n;
            await tokenBTC.mint(signers.deployer.address, btcBribe1);
            await internalBribe.notifyRewardAmount(tokenBTC.target, btcBribe1);
            await deployed.voter.connect(signers.otherUser1).vote(1, [pair], [100]);

            await advanceOneEpoch();

            // Epoch 2: deposit another bribe, re-vote
            const btcBribe2 = 20_000_000n;
            await tokenBTC.mint(signers.deployer.address, btcBribe2);
            await internalBribe.notifyRewardAmount(tokenBTC.target, btcBribe2);
            await deployed.voter.connect(signers.otherUser1).vote(1, [pair], [100]);

            await advanceOneEpoch();

            // Should have earned from both epochs
            const totalEarned = await internalBribe['earned(address,address)'](signers.otherUser1.address, tokenBTC.target);
            expect(totalEarned).to.be.eq(btcBribe1 + btcBribe2, 'Should accumulate rewards from both epochs');
        });
    });

    describe('Zero supply edge case', function () {
        it('should return 0 earned when no one voted', async function () {
            const btcBribeAmount = 10_000_000n;
            await tokenBTC.mint(signers.deployer.address, btcBribeAmount);
            await internalBribe.notifyRewardAmount(tokenBTC.target, btcBribeAmount);

            await deployed.votingEscrow.createLockFor(ethers.parseEther('1000'), 0, signers.otherUser1.address, false, true, 0);

            await advanceOneEpoch();

            const earned = await internalBribe['earned(address,address)'](signers.otherUser1.address, tokenBTC.target);
            expect(earned).to.be.eq(0, 'Should be 0 when user did not vote');
        });
    });
});
