import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { ZERO, ZERO_ADDRESS } from '../test/utils/constants';

import { loadFixture, time, takeSnapshot, SnapshotRestorer } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { VoterUpgradeableV2, ProxyAdmin } from '../typechain-types';

describe('VoterUpgrade Fork Test', function () {
    let deployer: HardhatEthersSigner;
    let proxyAdminOwner: HardhatEthersSigner;
    let voter: VoterUpgradeableV2;
    let proxyAdmin: ProxyAdmin;

    // Add your contract addresses from the forked network
    const VOTER_PROXY_ADDRESS = '0x566bdc5444fd5fe5d93ec379Bd66eC861ddbA901'; // TODO: Replace with actual Voter proxy address
    const PROXY_ADMIN_ADDRESS = '0xb688d5e73777DfaaDbD7c5Fe98Aee6F35CF20124'; // TODO: Replace with actual ProxyAdmin address
    const ADMIN_ADDRESS = '...';
    let startSnapshot: SnapshotRestorer;

    // 
    before(async () => {
        [deployer] = await ethers.getSigners();
        // Get existing Voter contract
        voter = await ethers.getContractAt('VoterUpgradeableV2', VOTER_PROXY_ADDRESS);
        proxyAdmin = await ethers.getContractAt('ProxyAdmin', PROXY_ADMIN_ADDRESS);

        const ownerOfAdminProxy = await proxyAdmin.owner();
        if (ownerOfAdminProxy == ethers.ZeroAddress) throw new Error('ProxyAdmin is not owned by any account');
        // Impersonate the proxy admin account
        await ethers.provider.send('hardhat_impersonateAccount', [ownerOfAdminProxy]);
        proxyAdminOwner = await ethers.getSigner(ownerOfAdminProxy);
        if (await voter.hasRole(await voter.DEFAULT_ADMIN_ROLE(), ownerOfAdminProxy)) throw new Error('Voter is not owned by the proxy admin owner');

        startSnapshot = await takeSnapshot();
    });

    describe('Pre-upgrade state', function () {
        it('should have correct initial state', async () => {
            // TODO: Add assertions to verify pre-upgrade state
            // Example:
            // expect(await voter.someStateVariable()).to.be.eq(expectedValue);
        });
    });

    describe('Upgrade process', function () {
        it('should deploy new implementation', async () => {
            // Deploy new VoterUpgradeableV2 implementation
            const newImplementation = await ethers.deployContract('VoterUpgradeableV2', []);
            await newImplementation.waitForDeployment();

            // TODO: Perform the upgrade through proxy admin
            // const proxyAdminContract = await ethers.getContractAt('ProxyAdmin', PROXY_ADMIN_ADDRESS);
            // await proxyAdminContract.connect(proxyAdmin).upgrade(VOTER_PROXY_ADDRESS, newImplementation.target);
        });
    });

    describe('Post-upgrade functionality', function () {
        it('should preserve existing state after upgrade', async () => {
            // TODO: Verify that existing state is preserved
            // Example:
            // expect(await voter.someStateVariable()).to.be.eq(expectedValue);
        });

        it('should have new functionality available', async () => {
            // TODO: Test new functionality added in VoterUpgradeableV2
        });
    });

    describe('Voting functionality', function () {
        it('should allow voting for gauges', async () => {
            // TODO: Test voting functionality
            // Example:
            // const epochTimestamp = await voter.epochTimestamp();
            // await voter.vote(tokenId, [gaugeAddress], [ethers.parseEther('1000')]);
        });

        it('should distribute rewards correctly', async () => {
            // TODO: Test reward distribution
            // Example:
            // await time.increase(7 * 86400);
            // await voter.distributeAll();
        });
    });
});
