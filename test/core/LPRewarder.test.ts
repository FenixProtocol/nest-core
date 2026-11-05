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

  it('restricts signer changes and token recovery to admins', async () => {
    const { admin, operator, nest, rewarder } = await loadFixture(fixture);
    const error = getAccessControlError(await rewarder.DEFAULT_ADMIN_ROLE(), operator.address);
    await expect(rewarder.connect(operator).setSigner(operator.address)).to.be.revertedWith(error);
    await expect(rewarder.connect(operator).recoverTokens(nest.target, 1)).to.be.revertedWith(error);
    await expect(rewarder.connect(operator).recoverTokens(ethers.ZeroAddress, 1)).to.be.revertedWith(error);
    await expect(rewarder.setSigner(admin.address)).to.emit(rewarder, 'SetSigner').withArgs(admin.address);
  });

  it('recovers any amount of reward or unrelated tokens to the admin', async () => {
    const { admin, nest, otherToken, rewarder } = await loadFixture(fixture);
    const nestAmount = ethers.parseEther('5');
    const otherAmount = ethers.parseEther('2');
    await nest.transfer(rewarder.target, nestAmount);
    await otherToken.transfer(rewarder.target, otherAmount);

    await expect(rewarder.recoverTokens(nest.target, ethers.parseEther('3')))
      .to.emit(rewarder, 'RecoverToken')
      .withArgs(nest.target, ethers.parseEther('3'));
    await rewarder.recoverTokens(nest.target, ethers.parseEther('2'));
    await rewarder.recoverTokens(otherToken.target, otherAmount);
    expect(await nest.balanceOf(rewarder.target)).to.equal(0);
    expect(await otherToken.balanceOf(rewarder.target)).to.equal(0);
    expect(await nest.balanceOf(admin.address)).to.equal(ethers.parseEther('100'));
    expect(await otherToken.balanceOf(admin.address)).to.equal(ethers.parseEther('100'));
  });

  it('recovers native tokens force-sent by selfdestruct when token is the zero address', async () => {
    const { admin, rewarder } = await loadFixture(fixture);
    const amount = ethers.parseEther('2');
    await expect(admin.sendTransaction({ to: rewarder.target, value: amount })).to.be.reverted;
    await ethers.deployContract('SelfDestructSenderMock', [rewarder.target], { value: amount });
    expect(await ethers.provider.getBalance(rewarder.target)).to.equal(amount);

    await expect(rewarder.recoverTokens(ethers.ZeroAddress, ethers.parseEther('0.5'))).to.changeEtherBalances(
      [rewarder, admin],
      [-ethers.parseEther('0.5'), ethers.parseEther('0.5')],
    );

    await expect(rewarder.recoverTokens(ethers.ZeroAddress, ethers.parseEther('1.5')))
      .to.emit(rewarder, 'RecoverToken')
      .withArgs(ethers.ZeroAddress, ethers.parseEther('1.5'));
    expect(await ethers.provider.getBalance(rewarder.target)).to.equal(0);
    await expect(rewarder.recoverTokens(ethers.ZeroAddress, 1)).to.be.revertedWithCustomError(rewarder, 'NativeTransferFailed');
  });

  it('claims signed cumulative amounts without notification or allocation', async () => {
    const { admin, user, otherUser, nest, otherToken, rewarder } = await loadFixture(fixture);
    await nest.transfer(rewarder.target, ethers.parseEther('10'));
    await otherToken.transfer(rewarder.target, ethers.parseEther('5'));
    await rewarder.setSigner(admin.address);

    const deadline = (await time.latest()) + 100;
    const identifier = ethers.id('first');
    const first = await signClaim(rewarder, admin, nest.target.toString(), user.address, ethers.parseEther('4'), deadline, identifier);
    await expect(
      rewarder
        .connect(user)
        ['claim(address,uint256,uint256,bytes32,bytes)'](nest.target, ethers.parseEther('4'), deadline, identifier, first),
    )
      .to.emit(rewarder, 'Claim')
      .withArgs(nest.target, user.address, ethers.parseEther('4'), ethers.parseEther('4'), identifier);
    await expect(
      rewarder
        .connect(user)
        ['claim(address,uint256,uint256,bytes32,bytes)'](nest.target, ethers.parseEther('4'), deadline, identifier, first),
    ).to.be.revertedWithCustomError(rewarder, 'AlreadyClaimed');

    const secondId = ethers.id('second');
    const second = await signClaim(rewarder, admin, nest.target.toString(), user.address, ethers.parseEther('7'), deadline, secondId);
    await rewarder
      .connect(user)
      ['claim(address,uint256,uint256,bytes32,bytes)'](nest.target, ethers.parseEther('7'), deadline, secondId, second);
    const other = await signClaim(
      rewarder,
      admin,
      otherToken.target.toString(),
      user.address,
      ethers.parseEther('5'),
      deadline,
      identifier,
    );
    await rewarder
      .connect(user)
      ['claim(address,uint256,uint256,bytes32,bytes)'](otherToken.target, ethers.parseEther('5'), deadline, identifier, other);
    const otherUserClaim = await signClaim(
      rewarder,
      admin,
      nest.target.toString(),
      otherUser.address,
      ethers.parseEther('3'),
      deadline,
      identifier,
    );
    await rewarder
      .connect(otherUser)
      ['claim(address,uint256,uint256,bytes32,bytes)'](nest.target, ethers.parseEther('3'), deadline, identifier, otherUserClaim);

    expect(await rewarder.claimed(nest.target, user.address)).to.equal(ethers.parseEther('7'));
    expect(await rewarder.claimed(nest.target, otherUser.address)).to.equal(ethers.parseEther('3'));
    expect(await rewarder.claimed(otherToken.target, user.address)).to.equal(ethers.parseEther('5'));
    expect(await rewarder.totalRewardClaimed(nest.target)).to.equal(ethers.parseEther('10'));
    expect(await rewarder.totalRewardClaimed(otherToken.target)).to.equal(ethers.parseEther('5'));
    expect(await nest.balanceOf(user.address)).to.equal(ethers.parseEther('7'));
  });

  it('requires a valid token, user, amount, identifier and EIP-712 domain in signatures', async () => {
    const { admin, user, otherUser, nest, otherToken, rewarder } = await loadFixture(fixture);
    await nest.transfer(rewarder.target, ethers.parseEther('2'));
    const deadline = (await time.latest()) + 100;
    const identifier = ethers.id('claim');
    const amount = ethers.parseEther('2');
    const valid = await signClaim(rewarder, admin, nest.target.toString(), user.address, amount, deadline, identifier);
    await expect(
      rewarder.connect(user)['claim(address,uint256,uint256,bytes32,bytes)'](nest.target, amount, deadline, identifier, valid),
    ).to.be.revertedWithCustomError(rewarder, 'ClaimDisabled');
    await rewarder.setSigner(admin.address);
    await expect(
      rewarder.connect(user)['claim(address,uint256,uint256,bytes32,bytes)'](nest.target, amount, 1, identifier, valid),
    ).to.be.revertedWithCustomError(rewarder, 'SignatureExpired');
    await expect(
      rewarder.connect(user)['claim(address,uint256,uint256,bytes32,bytes)'](otherToken.target, amount, deadline, identifier, valid),
    ).to.be.revertedWithCustomError(rewarder, 'InvalidSignature');
    await expect(
      rewarder.connect(otherUser)['claim(address,uint256,uint256,bytes32,bytes)'](nest.target, amount, deadline, identifier, valid),
    ).to.be.revertedWithCustomError(rewarder, 'InvalidSignature');
    await expect(
      rewarder.connect(user)['claim(address,uint256,uint256,bytes32,bytes)'](nest.target, amount, deadline, ethers.id('wrong'), valid),
    ).to.be.revertedWithCustomError(rewarder, 'InvalidSignature');
    await expect(
      rewarder.connect(user)['claim(address,uint256,uint256,bytes32,bytes)'](nest.target, amount - 1n, deadline, identifier, valid),
    ).to.be.revertedWithCustomError(rewarder, 'InvalidSignature');
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
    await expect(
      rewarder.connect(user)['claim(address,uint256,uint256,bytes32,bytes)'](nest.target, amount, deadline, identifier, wrongDomain),
    ).to.be.revertedWithCustomError(rewarder, 'InvalidSignature');
  });

  it('allows the claim-for role to pay the signed beneficiary', async () => {
    const { admin, user, operator, nest, rewarder } = await loadFixture(fixture);
    await nest.transfer(rewarder.target, ethers.parseEther('2'));
    await rewarder.setSigner(admin.address);
    const deadline = (await time.latest()) + 100;
    const identifier = ethers.id('claim-for');
    const signature = await signClaim(rewarder, admin, nest.target.toString(), user.address, ethers.parseEther('2'), deadline, identifier);
    const claim = () =>
      rewarder
        .connect(operator)
        ['claimFor(address,address,uint256,uint256,bytes32,bytes)'](
          nest.target,
          user.address,
          ethers.parseEther('2'),
          deadline,
          identifier,
          signature,
        );
    await expect(claim()).to.be.revertedWith(getAccessControlError(ethers.id('CLAMER_FOR_ROLE'), operator.address));
    await rewarder.grantRole(ethers.id('CLAMER_FOR_ROLE'), operator.address);
    await claim();
    expect(await nest.balanceOf(user.address)).to.equal(ethers.parseEther('2'));
    expect(await nest.balanceOf(operator.address)).to.equal(0);
  });

  it('claims multiple tokens with separate signatures', async () => {
    const { admin, user, operator, nest, otherToken, rewarder } = await loadFixture(fixture);
    const nestAmount = ethers.parseEther('4');
    const otherAmount = ethers.parseEther('3');
    await nest.transfer(rewarder.target, nestAmount);
    await otherToken.transfer(rewarder.target, otherAmount);
    await rewarder.setSigner(admin.address);
    const deadline = (await time.latest()) + 100;
    const nestId = ethers.id('batch-nest');
    const otherId = ethers.id('batch-other');
    const signatures = [
      await signClaim(rewarder, admin, nest.target.toString(), user.address, nestAmount, deadline, nestId),
      await signClaim(rewarder, admin, otherToken.target.toString(), user.address, otherAmount, deadline, otherId),
    ];
    const args = [
      [nest.target, otherToken.target],
      [nestAmount, otherAmount],
      [deadline, deadline],
      [nestId, otherId],
      signatures,
    ] as const;
    expect(await rewarder.connect(user)['claim(address[],uint256[],uint256[],bytes32[],bytes[])'].staticCall(...args)).to.deep.equal([
      nestAmount,
      otherAmount,
    ]);
    await rewarder.connect(user)['claim(address[],uint256[],uint256[],bytes32[],bytes[])'](...args);
    expect(await nest.balanceOf(user.address)).to.equal(nestAmount);
    expect(await otherToken.balanceOf(user.address)).to.equal(otherAmount);

    await rewarder.grantRole(ethers.id('CLAMER_FOR_ROLE'), operator.address);
    await nest.transfer(rewarder.target, nestAmount);
    await otherToken.transfer(rewarder.target, otherAmount);
    const forArgs = [
      args[0],
      operator.address,
      args[1],
      args[2],
      args[3],
      [
        await signClaim(rewarder, admin, nest.target.toString(), operator.address, nestAmount, deadline, nestId),
        await signClaim(rewarder, admin, otherToken.target.toString(), operator.address, otherAmount, deadline, otherId),
      ],
    ] as const;
    await rewarder.connect(operator)['claimFor(address[],address,uint256[],uint256[],bytes32[],bytes[])'](...forArgs);
    expect(await nest.balanceOf(operator.address)).to.equal(nestAmount);
    expect(await otherToken.balanceOf(operator.address)).to.equal(otherAmount);
  });

  it('rejects mismatched batch lengths and reverts an entire batch for an invalid signature', async () => {
    const { admin, user, operator, nest, otherToken, rewarder } = await loadFixture(fixture);
    await rewarder.grantRole(ethers.id('CLAMER_FOR_ROLE'), operator.address);
    const tokens = [nest.target];
    const amounts = [1n];
    const deadlines = [1];
    const identifiers = [ethers.id('batch')];
    const signatures = ['0x'];
    const invalid = [
      [[], amounts, deadlines, identifiers, signatures],
      [tokens, [], deadlines, identifiers, signatures],
      [tokens, amounts, [], identifiers, signatures],
      [tokens, amounts, deadlines, [], signatures],
      [tokens, amounts, deadlines, identifiers, []],
    ] as const;
    for (const [batchTokens, batchAmounts, batchDeadlines, batchIdentifiers, batchSignatures] of invalid) {
      await expect(
        rewarder
          .connect(user)
          ['claim(address[],uint256[],uint256[],bytes32[],bytes[])'](
            batchTokens,
            batchAmounts,
            batchDeadlines,
            batchIdentifiers,
            batchSignatures,
          ),
      ).to.be.revertedWithCustomError(rewarder, 'LengthMismatch');
      await expect(
        rewarder
          .connect(operator)
          ['claimFor(address[],address,uint256[],uint256[],bytes32[],bytes[])'](
            batchTokens,
            user.address,
            batchAmounts,
            batchDeadlines,
            batchIdentifiers,
            batchSignatures,
          ),
      ).to.be.revertedWithCustomError(rewarder, 'LengthMismatch');
    }

    await nest.transfer(rewarder.target, 1);
    await otherToken.transfer(rewarder.target, 1);
    await rewarder.setSigner(admin.address);
    const deadline = (await time.latest()) + 100;
    const identifier = ethers.id('atomic');
    const valid = await signClaim(rewarder, admin, nest.target.toString(), user.address, 1n, deadline, identifier);
    await expect(
      rewarder
        .connect(user)
        ['claim(address[],uint256[],uint256[],bytes32[],bytes[])'](
          [nest.target, otherToken.target],
          [1n, 1n],
          [deadline, deadline],
          [identifier, identifier],
          [valid, valid],
        ),
    ).to.be.revertedWithCustomError(rewarder, 'InvalidSignature');
    expect(await rewarder.claimed(nest.target, user.address)).to.equal(0);
    expect(await nest.balanceOf(user.address)).to.equal(0);
  });
});
