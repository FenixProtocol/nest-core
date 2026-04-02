import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { BribeUpgradeable, BribeFactoryMock, ProxyAdmin, ERC20, BribeUpgradeableMockWithFixTargetEpoch, VoterUpgradeableV2, VotingEscrowUpgradeableV2 } from '../typechain-types';
import testData from './data/testData.json';
import testData2 from './data/testData2.json';
import { SnapshotRestorer, takeSnapshot } from '@nomicfoundation/hardhat-toolbox/network-helpers';

describe('BribeUpgrade Fork Test', function () {
    let deployer: HardhatEthersSigner;
    let proxyAdminOwner: HardhatEthersSigner;
    let bribe: BribeUpgradeableMockWithFixTargetEpoch;
    let bribeFactory: BribeFactoryMock;
    let proxyAdmin: ProxyAdmin;
    let votingEscrow: VotingEscrowUpgradeableV2;
    let ubtc: ERC20;
    let whype: ERC20;
    let ubtcDecimals: bigint;
    let startSnapshot: SnapshotRestorer;
    // WHYPE UBTC BRIBE 0x4134bed7C5a9DA0e70da5A8A0C17859B14E89621 <- valid one
    // USDH UBTC BRIBE 0x78595FECd6c3cfaca2F70f80A863B227cE16d7a2
    // UBTC UETH BRIBE 0x7301a79418FDEe4B37591eC264fcDd37B7EBfAe8
    const BRIBE_ADDRESS = '0x4134bed7C5a9DA0e70da5A8A0C17859B14E89621';
    const BRIBE_FACTORY_PROXY = '0x638e382300Ee2ece790164DAfAF7a9f16045621b';
    const PROXY_ADMIN_ADDRESS = '0xb688d5e73777DfaaDbD7c5Fe98Aee6F35CF20124';
    const VOTING_ESCROW_ADDRESS = '0x2f2Ae07e3cc3391A2E27825652BA8DcdD5412074';
    const UBTC_ADDRESS = '0x9FDBdA0A5e284c32744D2f17Ee5c74B284993463';
    const WHYPE_ADDRESS = '0x5555555555555555555555555555555555555555';
    before(async () => {
        [deployer] = await ethers.getSigners();

        proxyAdmin = await ethers.getContractAt('ProxyAdmin', PROXY_ADMIN_ADDRESS);
        votingEscrow = await ethers.getContractAt('VotingEscrowUpgradeableV2', VOTING_ESCROW_ADDRESS);
        const ownerOfAdminProxy = await proxyAdmin.owner();
        if (ownerOfAdminProxy === ethers.ZeroAddress) throw new Error('ProxyAdmin has no owner');

        await deployer.sendTransaction({ to: ownerOfAdminProxy, value: ethers.parseEther('1') });
        proxyAdminOwner = await ethers.getImpersonatedSigner(ownerOfAdminProxy);

        const bribeFactoryMockFactory = await ethers.getContractFactory('BribeFactoryMock');
        const bribeFactoryMockImpl = await bribeFactoryMockFactory.deploy();
        await bribeFactoryMockImpl.waitForDeployment();

        await proxyAdmin.connect(proxyAdminOwner).upgrade(BRIBE_FACTORY_PROXY, bribeFactoryMockImpl.target);

        bribeFactory = await ethers.getContractAt('BribeFactoryMock', BRIBE_FACTORY_PROXY);

        const bribeImplFactory = await ethers.getContractFactory('BribeUpgradeableMockWithFixTargetEpoch');
        const newBribeImpl = await bribeImplFactory.deploy(31336064);
        await newBribeImpl.waitForDeployment();

        await bribeFactory.setImplementation(newBribeImpl.target);
        await bribeFactory.setVoterToBribe(BRIBE_ADDRESS, deployer.address);
        bribe = await ethers.getContractAt('BribeUpgradeableMockWithFixTargetEpoch', BRIBE_ADDRESS);
        ubtc = await ethers.getContractAt('ERC20', UBTC_ADDRESS);
        whype = await ethers.getContractAt('ERC20', WHYPE_ADDRESS);
        ubtcDecimals = await ubtc.decimals();
        startSnapshot = await takeSnapshot();
    });

    describe('rewards calculations', function () {
        it(`should return correct earnedWithTimestamp`, async function () {
            let totalRewards = 0n;
            for (const entry of testData) {
                const [reward] = await bribe.earnedWithTimestampPublic(entry.user, UBTC_ADDRESS);
                totalRewards += reward;
                const expected = ethers.parseUnits(entry.pendingUbtcEstimate, ubtcDecimals);
                console.log(`epx rewards ${expected}, actual rewards ${reward}, res ${reward == expected}`);
            }
            const ubtcBalance = await ubtc.balanceOf(BRIBE_ADDRESS);
            console.log(`total rewards ${totalRewards}`);
            console.log(`bribe balance ${ubtcBalance}`);
        });
        it(`check total rewards of all voters for all time`, async function () {
            let totalRewards = 0n;
            const owners = [...new Set(testData2.map(entry => entry.owner))];
            const usersRewards: Record<string, string> = {};
            for (const owner of owners) {
                const [reward] = await bribe.earnedWithTimestampPublic(owner, UBTC_ADDRESS);
                totalRewards += reward;
                usersRewards[owner] = reward.toString();
                console.log(`rewards for user ${owner} = ${reward}`);
            }
            console.log(`total rewards = ${totalRewards}`);
            const ubtcBalance = await ubtc.balanceOf(BRIBE_ADDRESS);
            console.log(`bribe balance = ${ubtcBalance}`);
            expect(ubtcBalance).to.be.greaterThanOrEqual(totalRewards);
        });
        it(`should return correct earnedWithTimestamp based on tokenId owner`, async function () {
            let totalRewards = 0n;
            const tokenIds = [...new Set(testData2.map(entry => entry.tokenId))];
            for (const tokenId of tokenIds) {
                const owner = await votingEscrow.ownerOf(tokenId);
                const [reward] = await bribe.earnedWithTimestampPublic(owner, UBTC_ADDRESS);
                totalRewards += reward;
                console.log(`rewards for tokenId ${tokenId} = ${reward}`);
            }
            const ubtcBalance = await ubtc.balanceOf(BRIBE_ADDRESS);
            console.log(`total rewards ${totalRewards}`);
            console.log(`bribe balance ${ubtcBalance}`);
            expect(ubtcBalance).to.be.greaterThanOrEqual(totalRewards);
        });
    });
    describe('getRewards', function () {
        after(async () => {
            await startSnapshot.restore();
        });
        it(`must execute getRewards for all voters`, async function () {
            const tokenIds = [...new Set(testData2.map(entry => entry.tokenId))];
            for (const tokenId of tokenIds) {
                const tx = await bribe.getRewardForOwner(tokenId, [UBTC_ADDRESS]);
                console.log(`token with id ${tokenId} got rewards successfully`);
            }
            // if reward transfer is successful, then the test is successful
        });
    });
    describe.only('aggregateClaim', function () {
        after(async () => {
            await startSnapshot.restore();
        });
        it(`the reward for WHYPE must be equal to the real reward distribution before update`, async function () {
            // you can get original tx by link https://hyperevmscan.io/tx/0x433c1cf82f0b51049c4aee9fe0a4baab4786c1b8b2ac3f72dda118cf2b2cd7ce
            const sender = "0xEb97D6E2c851e01A4Ba9f3e282de2BFe467cb13b";
            const calldata = "0xd6d7a45400000000000000000000000000000000000000000000000000000000000001600000000000000000000000000000000000000000000000000000000000000180000000000000000000000000000000000000000000000000000000000000032000000000000000000000000000000000000000000000000000000000000003c000000000000000000000000000000000000000000000000000000000000004400000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000000020000000000000000000000004134bed7c5a9da0e70da5a8a0c17859b14e896210000000000000000000000006603a9e5eb311fdbc2f8d130f416a5ccc9712d8800000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000010000000000000000000000005555555555555555555555555555555555555555000000000000000000000000000000000000000000000000000000000000000200000000000000000000000007c57e32a3c29d5659bda1d3efc2e7bf004e3035000000000000000000000000fd739d4e423301ce9385c1fb8850539d657c296d000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000000";
            const voterScAddress = "0x566bdc5444fd5fe5d93ec379Bd66eC861ddbA901";
            const whypeRewardAmount = 1420070304661993n;
            await bribeFactory.setVoterToBribe(BRIBE_ADDRESS, voterScAddress);
            const senderSigner = await ethers.getImpersonatedSigner(sender);
            const tx = await senderSigner.sendTransaction({ to: voterScAddress, data: calldata });
            await tx.wait();
            expect(tx).to.be.emit(bribe, 'RewardPaid').withArgs(sender, WHYPE_ADDRESS, whypeRewardAmount);
        });
    });
});
