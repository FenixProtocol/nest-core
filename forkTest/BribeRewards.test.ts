import { expect } from 'chai';
import { ethers } from 'hardhat';
import { BribeFactoryUpgradeable, BribeUpgradeable } from '../typechain-types';
// NOTE: This test was prepared to tests new implementation of RewardAPIUpgradeable contract,
// but RewardAPIUpgradeable contract stopped being used update of Frontend.
// So RewardAPIUpgradeable contract and the test are deprecated.
describe('BribeFactory Fork Test', function () {
    const BRIBE_FACTORY_PROXY = '0x638e382300Ee2ece790164DAfAF7a9f16045621b';
    const MALISIOUS_BRIBE_ADDRESS = '0x41dC71FA5C4181aaD3C49c303C1dc48DB44d8282';
    const NORMAL_BRIBE_ADDRESS = '0xc87DA0a3e03714fDbB84b8EF0C7D887FFAC9cddC';
    const VOTER_ADDRESS = '0x566bdc5444fd5fe5d93ec379Bd66eC861ddbA901';
    let bribeFactory: BribeFactoryUpgradeable;
    // let bribe: BribeUpgradeable;

    before(async () => {
        bribeFactory = await ethers.getContractAt('BribeFactoryUpgradeable', BRIBE_FACTORY_PROXY);
    });
    it('should revert bribe.getRewardTokens without a reason string', async () => {
        let bribe = await ethers.getContractAt('BribeUpgradeable', MALISIOUS_BRIBE_ADDRESS);
        await expect(bribe.getRewardTokens()).to.be.reverted;
    });
    it('should revert bribeFactory.getBribeRewardTokens for malicious bribe without a reason string', async () => {
        // const defaultRewardTokens = await bribeFactory.getDefaultRewardTokens();
        // const specificRewardTokens = await bribe.getSpecificRewardTokens();

        await expect(bribeFactory.getBribeRewardTokens(MALISIOUS_BRIBE_ADDRESS)).to.be.reverted;

        // expect(rewardTokens).to.deep.equal([...defaultRewardTokens, ...specificRewardTokens]);
    });
    it('should execute getBribeRewardTokens for the provided bribe', async () => {
        let bribe = await ethers.getContractAt('BribeUpgradeable', MALISIOUS_BRIBE_ADDRESS);
        const defaultRewardTokens = await bribeFactory.getDefaultRewardTokens();
        const specificRewardTokens = await bribe.getSpecificRewardTokens();
        const result = await bribeFactory.getBribeRewardTokens(NORMAL_BRIBE_ADDRESS);
        console.log(`expected length: ${defaultRewardTokens.length + specificRewardTokens.length}`);
        console.log(`result length: ${result.length}`);
        // expect(result).to.deep.equal([...defaultRewardTokens, ...specificRewardTokens]);
    });

    it('must execute functions bribe.getRewardTokens and correctly after updating implementation', async () => {
        const newBribeImpl = await ethers.deployContract('BribeUpgradeable');
        const factoryOwner = await bribeFactory.owner();
        const factoryOwnerSigner = await ethers.getImpersonatedSigner(factoryOwner);
        await bribeFactory.connect(factoryOwnerSigner).changeImplementation(newBribeImpl.target);
        const bribe = await ethers.getContractAt('BribeUpgradeable', MALISIOUS_BRIBE_ADDRESS);
        const result = await bribe.getRewardTokens();
        console.log(`result length: ${result.length}`);
    });
    it('must execute functions getAvailableBribesRewards and getBribeRewards of new APIReward implementation', async () => {
        const newApiReward = await ethers.deployContract('RewardAPIUpgradeable');
        await newApiReward.initialize(VOTER_ADDRESS);
        const USER = '0x798ed654F4D9599B99f94F4A61609b7A7cFBD200';
        const bribesToCheck = ["0x4134bed7C5a9DA0e70da5A8A0C17859B14E89621", "0x41dC71FA5C4181aaD3C49c303C1dc48DB44d8282", "0xDCD9d1F7C3Fa399DAC7E96E4320DF6874858EA83", "0x112dAD734b576e042b341655cEFc61BF7BAd0db2", "0xa02c84319d14DfF2DBf300413575399D6bC488b3", "0xe5DC5BD7A8AF43199DfcCF04ebe2e23749BB8959", "0xf36980D24b2DC95a66496239BbaBBc3B36c2a985"];
        // const availableBribeRewards = await newApiReward.getAvailableBribesRewards(USER, 100, 0);
        // console.log(`availableBribeRewards length: ${availableBribeRewards.length}`);
        for (const bribe of bribesToCheck) {
            const rewards = await newApiReward.getBribeRewards(USER, bribe);
            console.log(`bribe: ${bribe}, rewards length: ${rewards.amounts.length}`);
        }
    });
});
