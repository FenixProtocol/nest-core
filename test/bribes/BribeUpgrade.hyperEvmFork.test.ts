import { expect } from 'chai';
import { ethers } from 'hardhat';
import { setBalance, time } from '@nomicfoundation/hardhat-toolbox/network-helpers';

// November 9, 2026, before the reported first claim. A fixed block keeps the
// historical balances and reward data stable as HyperEVM advances.
const FORK_BLOCK = 50_800_000;
const BRIBE = '0x68652a0e5392f13707dcc8d52393c13d2ffc3a58';
const CLAIMANT = '0x42cb539780E7F74a7697891750D26f903a14865f';
const REWARD_EPOCH = 1_793_232_000n;

const forkEnabled = process.env.HYPE_FORK === 'true' && Number(process.env.HYPE_FORK_BLOCK) === FORK_BLOCK;

(forkEnabled ? describe : describe.skip)('BribeUpgradeable HyperEVM fork upgrade', function () {
  before(async function () {
    expect(await ethers.provider.getCode(BRIBE)).to.not.eq('0x');
    await ethers.provider.send('evm_mine', []);
  });

  it('upgrades the factory implementation and pays a historical first-time claimant in one call', async function () {
    const bribe = await ethers.getContractAt('BribeUpgradeable', BRIBE);
    const factory = await ethers.getContractAt('BribeFactoryUpgradeable', await bribe.bribeFactory());
    const firstBribeTimestamp = await bribe.firstBribeTimestamp();
    const activeEpoch = await bribe.getEpochStart();
    const votingPower = await bribe.balanceOfOwnerAt(CLAIMANT, REWARD_EPOCH);
    const totalPower = await bribe.totalSupplyAt(REWARD_EPOCH);
    expect(firstBribeTimestamp).to.eq(1_763_596_800n);
    expect(votingPower).to.be.gt(0);
    expect(totalPower).to.be.gt(0);

    const tokens = await bribe.rewardsList();
    const affectedTokens: string[] = [];
    for (const token of tokens) {
      const data = await bribe.rewardData(token, REWARD_EPOCH);
      if (data.rewardsPerEpoch > 0n) affectedTokens.push(token);
    }
    expect(affectedTokens.length).to.be.gt(0);

    for (const token of affectedTokens) {
      expect(await bribe.userTimestamp(CLAIMANT, token)).to.eq(0);
      expect(await bribe['earned(address,address)'](CLAIMANT, token)).to.eq(0);
    }

    const previousImplementation = await factory.bribeImplementation();
    const implementation = await ethers.deployContract('BribeUpgradeable');
    const factoryOwner = await factory.owner();
    await setBalance(factoryOwner, ethers.parseEther('1'));
    await factory.connect(await ethers.getImpersonatedSigner(factoryOwner)).changeImplementation(implementation.target);
    expect(await factory.bribeImplementation()).to.eq(implementation.target);
    expect(await factory.bribeImplementation()).to.not.eq(previousImplementation);
    expect(await bribe.firstBribeTimestamp()).to.eq(firstBribeTimestamp);
    expect(await bribe.balanceOfOwnerAt(CLAIMANT, REWARD_EPOCH)).to.eq(votingPower);

    const expected = new Map<string, bigint>();
    for (const token of affectedTokens) {
      const data = await bribe.rewardData(token, REWARD_EPOCH);
      const epochReward = (votingPower * data.rewardsPerEpoch) / totalPower;
      const earned = await bribe['earned(address,address)'](CLAIMANT, token);
      expect(earned).to.be.gte(epochReward);
      expect(earned).to.be.gt(0);
      expected.set(token, earned);
    }

    const preClaimSnapshot = await ethers.provider.send('evm_snapshot', []);

    await setBalance(CLAIMANT, ethers.parseEther('1'));
    const claimant = await ethers.getImpersonatedSigner(CLAIMANT);
    const balances = new Map<string, bigint>();
    for (const token of affectedTokens) {
      const erc20 = await ethers.getContractAt('IERC20Upgradeable', token);
      balances.set(token, await erc20.balanceOf(CLAIMANT));
    }
    await bribe.connect(claimant)['getReward(address[])'](affectedTokens);

    for (const token of affectedTokens) {
      const erc20 = await ethers.getContractAt('IERC20Upgradeable', token);
      expect((await erc20.balanceOf(CLAIMANT)) - balances.get(token)!).to.eq(expected.get(token));
      expect(await bribe.userTimestamp(CLAIMANT, token)).to.eq(activeEpoch);
      expect(await bribe['earned(address,address)'](CLAIMANT, token)).to.eq(0);
    }
    await ethers.provider.send('evm_revert', [preClaimSnapshot]);
  });

  it('finds the 3M gas limit for both two-token getReward overloads', async function () {
    const bribe = await ethers.getContractAt('BribeUpgradeable', BRIBE);
    const minter = await ethers.getContractAt('MinterUpgradeable', await bribe.minter());
    await setBalance(CLAIMANT, ethers.parseEther('1'));
    const claimant = await ethers.getImpersonatedSigner(CLAIMANT);
    const ve = await ethers.getContractAt('VotingEscrowUpgradeableV2', await bribe.ve());
    expect(await ve.ownerOf(2372)).to.eq(CLAIMANT);
    const tokens: string[] = [];
    for (const token of await bribe.rewardsList()) {
      if ((await bribe.rewardData(token, REWARD_EPOCH)).rewardsPerEpoch > 0n) tokens.push(token);
    }
    expect(tokens.length).to.eq(2);

    for (const [mode, weeks, fitsSmallBlock] of [
      ['address', 855, true],
      ['address', 856, false],
      ['tokenId', 850, true],
      ['tokenId', 851, false],
    ] as const) {
      const snapshot = await ethers.provider.send('evm_snapshot', []);
      await time.increase((weeks + 1) * 604_800);
      await minter.update_period();
      const scannedEpochs = (await bribe.getEpochStart() - (await bribe.firstBribeTimestamp() - 604_800n)) / 604_800n;
      expect(scannedEpochs).to.eq(BigInt(52 + weeks));
      const claim = (gasLimit: bigint) => mode === 'address'
        ? bribe.connect(claimant)['getReward(address[])'](tokens, { gasLimit })
        : bribe.connect(claimant)['getReward(uint256,address[])'](2372, tokens, { gasLimit });
      if (fitsSmallBlock) {
        const tx = await claim(3_000_000n);
        const gasUsed = (await tx.wait())!.gasUsed;
        expect(gasUsed).to.be.lt(3_000_000n);
        console.log(`${mode}, ${scannedEpochs} epochs: ${gasUsed} gas used with 3M cap`);
      } else {
        await expect(claim(3_000_000n)).to.be.reverted;
        const tx = await claim(4_000_000n);
        const gasUsed = (await tx.wait())!.gasUsed;
        expect(gasUsed).to.be.lt(4_000_000n);
        console.log(`${mode}, ${scannedEpochs} epochs: ${gasUsed} gas used with 4M cap`);
      }
      await ethers.provider.send('evm_revert', [snapshot]);
    }
  });

  it('preserves an existing owner\'s unpaid rewards when they deposit after upgrade', async function () {
    const bribe = await ethers.getContractAt('BribeUpgradeable', BRIBE);
    const tokens: string[] = [];
    for (const token of await bribe.rewardsList()) {
      if ((await bribe.rewardData(token, REWARD_EPOCH)).rewardsPerEpoch > 0n) tokens.push(token);
    }
    expect(tokens.length).to.eq(2);
    const expected = new Map<string, bigint>();
    for (const token of tokens) {
      expect(await bribe.userTimestamp(CLAIMANT, token)).to.eq(0);
      expected.set(token, await bribe['earned(address,address)'](CLAIMANT, token));
      expect(expected.get(token)).to.be.gt(0);
    }

    const voterAddress = await bribe.voter();
    await setBalance(voterAddress, ethers.parseEther('1'));
    await bribe.connect(await ethers.getImpersonatedSigner(voterAddress)).deposit(1n, 2372);
    for (const token of tokens) {
      expect(await bribe.userTimestamp(CLAIMANT, token)).to.eq(0);
      expect(await bribe['earned(address,address)'](CLAIMANT, token)).to.eq(expected.get(token));
    }

    await setBalance(CLAIMANT, ethers.parseEther('1'));
    const claimant = await ethers.getImpersonatedSigner(CLAIMANT);
    const balances = new Map<string, bigint>();
    for (const token of tokens) {
      const erc20 = await ethers.getContractAt('IERC20Upgradeable', token);
      balances.set(token, await erc20.balanceOf(CLAIMANT));
    }
    await bribe.connect(claimant)['getReward(uint256,address[])'](2372, tokens);
    for (const token of tokens) {
      const erc20 = await ethers.getContractAt('IERC20Upgradeable', token);
      expect((await erc20.balanceOf(CLAIMANT)) - balances.get(token)!).to.eq(expected.get(token));
      expect(await bribe.userTimestamp(CLAIMANT, token)).to.eq(await bribe.getEpochStart());
    }
  });
});
