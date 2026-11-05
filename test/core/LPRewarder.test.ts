import { loadFixture, time } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { LPRewarder } from '../../typechain-types';
import { getAccessControlError } from '../utils/constants';

describe('LPRewarder', function () {
  async function fixture() {
    const [admin, user, otherUser, operator, proxyAdmin] = await ethers.getSigners();
    const nest = await ethers.deployContract('ERC20Mock', ['NEST', 'NEST', 18]);
    const otherToken = await ethers.deployContract('ERC20Mock', ['Other', 'OTHER', 18]);
    const implementation = await ethers.deployContract('LPRewarder');
    const proxy = await ethers.deployContract('TransparentUpgradeableProxy', [implementation.target, proxyAdmin.address, '0x']);
    const rewarder = await ethers.getContractAt('LPRewarder', proxy.target);
    await rewarder.initialize();
    await nest.mint(admin.address, ethers.parseEther('100'));
    await otherToken.mint(admin.address, ethers.parseEther('100'));
    return { admin, user, otherUser, operator, nest, otherToken, implementation, rewarder };
  }

  async function signClaim(
    rewarder: LPRewarder,
    signer: HardhatEthersSigner,
    token: string,
    user: string,
    totalAmount: bigint,
    deadline: number,
    identifier: string,
    domainName = 'LPRewarder',
  ) {
    return signer.signTypedData(
      {
        name: domainName,
        version: '1',
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: await rewarder.getAddress(),
      },
      {
        Claim: [
          { name: 'token', type: 'address' },
          { name: 'user', type: 'address' },
          { name: 'totalAmount', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
          { name: 'identifier', type: 'bytes32' },
        ],
      },
      { token, user, totalAmount, deadline, identifier },
    );
  }

  it('initializes once and assigns the deployer admin role', async () => {
    const { admin, implementation, rewarder } = await loadFixture(fixture);
    expect(await rewarder.hasRole(await rewarder.DEFAULT_ADMIN_ROLE(), admin.address)).to.be.true;
    expect(await rewarder.signer()).to.equal(ethers.ZeroAddress);
    await expect(rewarder.initialize()).to.be.revertedWith('Initializable: contract is already initialized');
    await expect(implementation.initialize()).to.be.revertedWith('Initializable: contract is already initialized');
  });

  it('restricts allocations and signer changes to admins', async () => {
    const { admin, user, operator, nest, rewarder } = await loadFixture(fixture);
    const error = getAccessControlError(await rewarder.DEFAULT_ADMIN_ROLE(), operator.address);
    await expect(rewarder.connect(operator).setSigner(operator.address)).to.be.revertedWith(error);
    await expect(rewarder.connect(operator).notifyReward(nest.target, user.address, 1)).to.be.revertedWith(error);
    await expect(rewarder.connect(operator).notifyRewardWithTransfer(nest.target, user.address, 1)).to.be.revertedWith(error);
    await expect(rewarder.setSigner(admin.address)).to.emit(rewarder, 'SetSigner').withArgs(admin.address);
  });

  it('allocates deposited tokens by token and user without allocating the same balance twice', async () => {
    const { admin, user, otherUser, nest, otherToken, rewarder } = await loadFixture(fixture);
    await nest.transfer(rewarder.target, ethers.parseEther('10'));
    await otherToken.transfer(rewarder.target, ethers.parseEther('5'));
    await expect(rewarder.notifyReward(nest.target, user.address, ethers.parseEther('6')))
      .to.emit(rewarder, 'NotifyReward')
      .withArgs(admin.address, nest.target, user.address, ethers.parseEther('6'));
    await expect(rewarder.notifyReward(nest.target, otherUser.address, ethers.parseEther('5'))).to.be.revertedWithCustomError(
      rewarder,
      'InsufficientAvailableBalance',
    );
    await rewarder.notifyReward(nest.target, otherUser.address, ethers.parseEther('4'));
    await rewarder.notifyReward(otherToken.target, user.address, 0);
    expect(await rewarder.totalRewards(nest.target, user.address)).to.equal(ethers.parseEther('6'));
    expect(await rewarder.totalRewards(nest.target, otherUser.address)).to.equal(ethers.parseEther('4'));
    expect(await rewarder.totalRewards(otherToken.target, user.address)).to.equal(ethers.parseEther('5'));
    expect(await rewarder.totalRewardDistributed(nest.target)).to.equal(ethers.parseEther('10'));
    expect(await rewarder.totalRewardDistributed(otherToken.target)).to.equal(ethers.parseEther('5'));
    await expect(rewarder.notifyReward(nest.target, user.address, 0)).to.be.revertedWithCustomError(rewarder, 'ZeroRewardAmount');
  });

  it('pulls tokens from an admin and validates allocation addresses', async () => {
    const { admin, user, nest, rewarder } = await loadFixture(fixture);
    const amount = ethers.parseEther('3');
    await expect(rewarder.notifyRewardWithTransfer(nest.target, user.address, amount)).to.be.revertedWith('ERC20: insufficient allowance');
    await nest.approve(rewarder.target, amount);
    await expect(rewarder.notifyRewardWithTransfer(nest.target, user.address, amount))
      .to.emit(rewarder, 'NotifyReward')
      .withArgs(admin.address, nest.target, user.address, amount);
    expect(await nest.balanceOf(rewarder.target)).to.equal(amount);
    expect(await rewarder.totalRewards(nest.target, user.address)).to.equal(amount);
    await expect(rewarder.notifyReward(ethers.ZeroAddress, user.address, 1)).to.be.revertedWithCustomError(rewarder, 'AddressZero');
    await expect(rewarder.notifyReward(nest.target, ethers.ZeroAddress, 1)).to.be.revertedWithCustomError(rewarder, 'AddressZero');
    await expect(rewarder.notifyRewardWithTransfer(ethers.ZeroAddress, user.address, 1)).to.be.revertedWithCustomError(
      rewarder,
      'AddressZero',
    );
  });

  it('claims cumulative amounts independently per token and user', async () => {
    const { admin, user, otherUser, nest, otherToken, rewarder } = await loadFixture(fixture);
    await nest.approve(rewarder.target, ethers.parseEther('10'));
    await otherToken.approve(rewarder.target, ethers.parseEther('5'));
    await rewarder.notifyRewardWithTransfer(nest.target, user.address, ethers.parseEther('7'));
    await rewarder.notifyRewardWithTransfer(nest.target, otherUser.address, ethers.parseEther('3'));
    await rewarder.notifyRewardWithTransfer(otherToken.target, user.address, ethers.parseEther('5'));
    await rewarder.setSigner(admin.address);

    const deadline = (await time.latest()) + 100;
    const identifier = ethers.id('first');
    const nestFour = await signClaim(rewarder, admin, nest.target.toString(), user.address, ethers.parseEther('4'), deadline, identifier);
    await expect(rewarder.connect(user).claim(nest.target, ethers.parseEther('4'), deadline, identifier, nestFour))
      .to.emit(rewarder, 'Claim')
      .withArgs(nest.target, user.address, ethers.parseEther('4'), ethers.parseEther('4'), identifier);
    await expect(
      rewarder.connect(user).claim(nest.target, ethers.parseEther('4'), deadline, identifier, nestFour),
    ).to.be.revertedWithCustomError(rewarder, 'AlreadyClaimed');
    const nestSeven = await signClaim(
      rewarder,
      admin,
      nest.target.toString(),
      user.address,
      ethers.parseEther('7'),
      deadline,
      ethers.id('second'),
    );
    await rewarder.connect(user).claim(nest.target, ethers.parseEther('7'), deadline, ethers.id('second'), nestSeven);
    const otherFive = await signClaim(
      rewarder,
      admin,
      otherToken.target.toString(),
      user.address,
      ethers.parseEther('5'),
      deadline,
      identifier,
    );
    await rewarder.connect(user).claim(otherToken.target, ethers.parseEther('5'), deadline, identifier, otherFive);
    const otherUserThree = await signClaim(
      rewarder,
      admin,
      nest.target.toString(),
      otherUser.address,
      ethers.parseEther('3'),
      deadline,
      identifier,
    );
    await rewarder.connect(otherUser).claim(nest.target, ethers.parseEther('3'), deadline, identifier, otherUserThree);

    expect(await rewarder.claimed(nest.target, user.address)).to.equal(ethers.parseEther('7'));
    expect(await rewarder.claimed(nest.target, otherUser.address)).to.equal(ethers.parseEther('3'));
    expect(await rewarder.claimed(otherToken.target, user.address)).to.equal(ethers.parseEther('5'));
    expect(await rewarder.totalRewardClaimed(nest.target)).to.equal(ethers.parseEther('10'));
    expect(await rewarder.totalRewardClaimed(otherToken.target)).to.equal(ethers.parseEther('5'));
    expect(await nest.balanceOf(user.address)).to.equal(ethers.parseEther('7'));
    expect(await otherToken.balanceOf(user.address)).to.equal(ethers.parseEther('5'));
  });

  it('requires a valid token, user, amount, identifier and EIP-712 domain in signatures', async () => {
    const { admin, user, otherUser, nest, otherToken, rewarder } = await loadFixture(fixture);
    await nest.approve(rewarder.target, ethers.parseEther('2'));
    await rewarder.notifyRewardWithTransfer(nest.target, user.address, ethers.parseEther('2'));
    const deadline = (await time.latest()) + 100;
    const identifier = ethers.id('allocation');
    const amount = ethers.parseEther('2');
    const valid = await signClaim(rewarder, admin, nest.target.toString(), user.address, amount, deadline, identifier);
    await expect(rewarder.connect(user).claim(nest.target, amount, deadline, identifier, valid)).to.be.revertedWithCustomError(
      rewarder,
      'ClaimDisabled',
    );
    await rewarder.setSigner(admin.address);
    await expect(rewarder.connect(user).claim(nest.target, amount, 1, identifier, valid)).to.be.revertedWithCustomError(
      rewarder,
      'SignatureExpired',
    );
    await expect(rewarder.connect(user).claim(otherToken.target, amount, deadline, identifier, valid)).to.be.revertedWithCustomError(
      rewarder,
      'InvalidSignature',
    );
    await expect(rewarder.connect(otherUser).claim(nest.target, amount, deadline, identifier, valid)).to.be.revertedWithCustomError(
      rewarder,
      'InvalidSignature',
    );
    await expect(rewarder.connect(user).claim(nest.target, amount, deadline, ethers.id('wrong'), valid)).to.be.revertedWithCustomError(
      rewarder,
      'InvalidSignature',
    );
    await expect(rewarder.connect(user).claim(nest.target, amount - 1n, deadline, identifier, valid)).to.be.revertedWithCustomError(
      rewarder,
      'InvalidSignature',
    );
    const wrongDomain = await signClaim(
      rewarder,
      admin,
      nest.target.toString(),
      user.address,
      amount,
      deadline,
      identifier,
      'OtherRewarder',
    );
    await expect(rewarder.connect(user).claim(nest.target, amount, deadline, identifier, wrongDomain)).to.be.revertedWithCustomError(
      rewarder,
      'InvalidSignature',
    );
  });

  it('caps claims by the user allocation even when the contract holds extra tokens', async () => {
    const { admin, user, nest, rewarder } = await loadFixture(fixture);
    await nest.transfer(rewarder.target, ethers.parseEther('5'));
    await rewarder.notifyReward(nest.target, user.address, ethers.parseEther('2'));
    await rewarder.setSigner(admin.address);
    const deadline = (await time.latest()) + 100;
    const identifier = ethers.id('allocation');
    const signature = await signClaim(rewarder, admin, nest.target.toString(), user.address, ethers.parseEther('3'), deadline, identifier);
    await expect(
      rewarder.connect(user).claim(nest.target, ethers.parseEther('3'), deadline, identifier, signature),
    ).to.be.revertedWithCustomError(rewarder, 'InsufficientRewardAllocation');
    await rewarder.notifyReward(nest.target, user.address, ethers.parseEther('1'));
    await rewarder.connect(user).claim(nest.target, ethers.parseEther('3'), deadline, identifier, signature);
    expect(await rewarder.claimed(nest.target, user.address)).to.equal(ethers.parseEther('3'));
  });

  it('keeps unclaimed allocations reserved when another user is funded after a claim', async () => {
    const { admin, user, otherUser, nest, rewarder } = await loadFixture(fixture);
    await nest.approve(rewarder.target, ethers.parseEther('2'));
    await rewarder.notifyRewardWithTransfer(nest.target, user.address, ethers.parseEther('2'));
    await rewarder.setSigner(admin.address);
    const deadline = (await time.latest()) + 100;
    const identifier = ethers.id('partial');
    const signature = await signClaim(rewarder, admin, nest.target.toString(), user.address, ethers.parseEther('1'), deadline, identifier);
    await rewarder.connect(user).claim(nest.target, ethers.parseEther('1'), deadline, identifier, signature);

    await expect(rewarder.notifyReward(nest.target, otherUser.address, ethers.parseEther('1'))).to.be.revertedWithCustomError(
      rewarder,
      'InsufficientAvailableBalance',
    );
    await nest.transfer(rewarder.target, ethers.parseEther('1'));
    await rewarder.notifyReward(nest.target, otherUser.address, ethers.parseEther('1'));
    expect(await rewarder.totalRewards(nest.target, user.address)).to.equal(ethers.parseEther('2'));
    expect(await rewarder.totalRewards(nest.target, otherUser.address)).to.equal(ethers.parseEther('1'));
  });

  it('allows the claim-for role to pay the user', async () => {
    const { admin, user, operator, nest, rewarder } = await loadFixture(fixture);
    await nest.approve(rewarder.target, ethers.parseEther('2'));
    await rewarder.notifyRewardWithTransfer(nest.target, user.address, ethers.parseEther('2'));
    await rewarder.setSigner(admin.address);
    const deadline = (await time.latest()) + 100;
    const identifier = ethers.id('claim-for');
    const signature = await signClaim(rewarder, admin, nest.target.toString(), user.address, ethers.parseEther('2'), deadline, identifier);
    await expect(rewarder.claimFor(nest.target, user.address, ethers.parseEther('2'), deadline, identifier, signature)).to.be.revertedWith(
      getAccessControlError(ethers.id('CLAMER_FOR_ROLE'), admin.address),
    );
    await rewarder.grantRole(ethers.id('CLAMER_FOR_ROLE'), operator.address);
    await rewarder.connect(operator).claimFor(nest.target, user.address, ethers.parseEther('2'), deadline, identifier, signature);
    expect(await nest.balanceOf(user.address)).to.equal(ethers.parseEther('2'));
    expect(await nest.balanceOf(operator.address)).to.equal(0);
  });
});
