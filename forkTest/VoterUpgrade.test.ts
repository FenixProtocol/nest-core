import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { ZERO, ZERO_ADDRESS } from '../test/utils/constants';

import { loadFixture, time, takeSnapshot, SnapshotRestorer } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { VoterUpgradeableV2, ProxyAdmin, ERC20 } from '../typechain-types';

describe('VoterUpgrade Fork Test', function () {
    let deployer: HardhatEthersSigner;
    let proxyAdminOwner: HardhatEthersSigner;
    let voter: VoterUpgradeableV2;
    let proxyAdmin: ProxyAdmin;

    // Add your contract addresses from the forked network
    const VOTER_PROXY_ADDRESS = '0x566bdc5444fd5fe5d93ec379Bd66eC861ddbA901'; // TODO: Replace with actual Voter proxy address
    const PROXY_ADMIN_ADDRESS = '0xb688d5e73777DfaaDbD7c5Fe98Aee6F35CF20124'; // TODO: Replace with actual ProxyAdmin address

    // 
    before(async () => {
        [deployer] = await ethers.getSigners();
        // Get existing Voter contract
        voter = await ethers.getContractAt('VoterUpgradeableV2', VOTER_PROXY_ADDRESS);
        proxyAdmin = await ethers.getContractAt('ProxyAdmin', PROXY_ADMIN_ADDRESS);

        const ownerOfAdminProxy = await proxyAdmin.owner();
        if (ownerOfAdminProxy == ethers.ZeroAddress) throw new Error('ProxyAdmin is not owned by any account');
        proxyAdminOwner = await ethers.getImpersonatedSigner(ownerOfAdminProxy);
    });

    describe('Upgrade process', function () {
        it('should deploy new implementation', async () => {
            // Deploy new VoterUpgradeableV2 implementation
            const voterFactory = await ethers.getContractFactory('VoterUpgradeableV2');
            const newImplementation = await voterFactory.deploy();
            await newImplementation.waitForDeployment();
            const currentEpoch = await voter.epochTimestamp();
            const currentIndex = await voter.index();
            const epochs = [currentEpoch];
            const epochIndexes = [currentIndex];
            // store current index to not cause underflow error while next distribution
            const callData = voter.interface.encodeFunctionData('reinitialize', [epochs, epochIndexes]);
            await proxyAdmin.connect(proxyAdminOwner).upgradeAndCall(VOTER_PROXY_ADDRESS, newImplementation.target, callData);
            expect(await voter.indexPerEpoch(currentEpoch)).to.be.eq(currentIndex);
            await expect(voter.reinitialize(epochs, epochIndexes)).to.be.revertedWith('Initializable: contract is already initialized');
        });
    });

    describe('distribute', function () {
        it('must execute distribute all after upgrade in next epoch', async function () {
            const currentEpoch = await voter.epochTimestamp();
            const currentIndex = await voter.index();
            let gauges: any[] = [];
            let pools: any[] = [];
            let weightsPerEpoch: any[] = [];
            let gaugesBalances: any[] = [];
            let poolsAmount = await voter.poolsCounts();
            for (let i = 0; i < poolsAmount.totalCount; i++) {
                pools.push(await voter.pools(i));
                gauges.push(await voter.poolToGauge(await voter.pools(i)));
            }
            for (let i = 0; i < gauges.length; i++) {
                weightsPerEpoch.push(await voter.weightsPerEpoch(currentEpoch, pools[i]));
            }
            const token = await voter.token();
            const erc20Factory = await ethers.getContractFactory('ERC20');
            const erc20 = await erc20Factory.attach(token) as ERC20;
            for (let i = 0; i < gauges.length; i++) {
                gaugesBalances.push(await erc20.balanceOf(gauges[i]));
            }
            await time.increaseTo(currentEpoch + BigInt(60 * 60 * 24 * 7) + 100n);
            const tx = await voter.distributeAll({ gasLimit: 10000000 });
            await tx.wait();
            expect(await voter.indexPerEpoch(currentEpoch)).to.be.eq(currentIndex);
            const nextEpoch = await voter.epochTimestamp();
            const nextIndex = await voter.index();
            expect(await voter.index()).to.be.gt(currentIndex);
            expect(await voter.indexPerEpoch(nextEpoch)).to.be.eq(nextIndex);
            for (let i = 0; i < gauges.length; i++) {
                if (weightsPerEpoch[i] > 0n && !(await (await ethers.getContractAt('GaugeUpgradeable', gauges[i])).isDistributeEmissionToMerkle())) {
                    expect(await erc20.balanceOf(gauges[i])).to.be.gt(gaugesBalances[i]);
                } else {
                    expect(await erc20.balanceOf(gauges[i])).to.be.eq(gaugesBalances[i]);
                }
            }
        });
    });
});