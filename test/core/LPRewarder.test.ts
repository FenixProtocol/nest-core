import { loadFixture, time } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { LPRewarder } from '../../typechain-types';
import { getAccessControlError } from '../utils/constants';

const WEEK = 86400 * 7;
const POOL_1 = '0x0000000000000000000000000000000000000001';
const POOL_2 = '0x0000000000000000000000000000000000000002';

describe('LPRewarder', function () {
  async function fixture() {
    const [admin, provider, otherProvider, operator, proxyAdmin] = await ethers.getSigners();
    const nest = await ethers.deployContract('ERC20Mock', ['NEST', 'NEST', 18]);
    const implementation = await ethers.deployContract('LPRewarder');
    const proxy = await ethers.deployContract('TransparentUpgradeableProxy', [implementation.target, proxyAdmin.address, '0x']);
    const rewarder = await ethers.getContractAt('LPRewarder', proxy.target);
    await rewarder.initialize(nest.target);
    await nest.mint(admin.address, ethers.parseEther('1000'));
    return { admin, provider, otherProvider, operator, nest, implementation, rewarder };
  }

  async function signClaim(
    rewarder: LPRewarder,
    signer: HardhatEthersSigner,
    user: string,
    totalAmount: bigint,
    deadline: number,
    identifier?: string,
    domainName = 'LPRewarder',
  ) {
    const domain = {
      name: domainName,
      version: '1',
      chainId: (await ethers.provider.getNetwork()).chainId,
      verifyingContract: await rewarder.getAddress(),
    };
    if (identifier !== undefined) {
      return signer.signTypedData(
        domain,
        {
          PositionClaim: [
            { name: 'user', type: 'address' },
            { name: 'totalAmount', type: 'uint256' },
            { name: 'deadline', type: 'uint256' },
            { name: 'identifier', type: 'bytes32' },
          ],
        },
        { user, totalAmount, deadline, identifier },
      );
    }
    return signer.signTypedData(
      domain,
      {
        Claim: [
          { name: 'user', type: 'address' },
          { name: 'totalAmount', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ],
      },
      { user, totalAmount, deadline },
    );
  }

  it('initializes once with NEST and the deployer as admin', async () => {
    const { admin, nest, implementation, rewarder } = await loadFixture(fixture);
    expect(await rewarder.token()).to.equal(nest.target);
    expect(await rewarder.hasRole(await rewarder.DEFAULT_ADMIN_ROLE(), admin.address)).to.be.true;
    expect(await rewarder.totalRewardDistributed()).to.equal(0);
    expect(await rewarder.totalRewardClaimed()).to.equal(0);
    await expect(rewarder.initialize(nest.target)).to.be.revertedWith('Initializable: contract is already initialized');
    await expect(implementation.initialize(nest.target)).to.be.revertedWith('Initializable: contract is already initialized');
    const proxy = await ethers.deployContract('TransparentUpgradeableProxy', [
      implementation.target,
      (await ethers.getSigners())[4].address,
      '0x',
    ]);
    const fresh = await ethers.getContractAt('LPRewarder', proxy.target);
    await expect(fresh.initialize(ethers.ZeroAddress)).to.be.revertedWithCustomError(fresh, 'AddressZero');
  });

  it('limits signer management and both notification methods to admins', async () => {
    const { admin, operator, rewarder } = await loadFixture(fixture);
    const error = getAccessControlError(await rewarder.DEFAULT_ADMIN_ROLE(), operator.address);
    await expect(rewarder.connect(operator).setSigner(operator.address)).to.be.revertedWith(error);
    await expect(rewarder.connect(operator).notifyReward(POOL_1, 0)).to.be.revertedWith(error);
    await expect(rewarder.connect(operator).notifyRewardWithTransfer(POOL_1, 1)).to.be.revertedWith(error);
    await rewarder.grantRole(await rewarder.DEFAULT_ADMIN_ROLE(), operator.address);
    await expect(rewarder.connect(operator).setSigner(admin.address)).to.emit(rewarder, 'SetSigner').withArgs(admin.address);
  });

  it('allocates only unallocated NEST, including deposits made before and after claims', async () => {
    const { admin, provider, nest, rewarder } = await loadFixture(fixture);
    const ten = ethers.parseEther('10');
    const epoch = BigInt(Math.floor((await time.latest()) / WEEK) * WEEK);
    await expect(rewarder.notifyReward(POOL_1, 0)).to.be.revertedWithCustomError(rewarder, 'ZeroRewardAmount');
    await nest.transfer(rewarder.target, ten);
    await expect(rewarder.notifyReward(POOL_1, ten + 1n)).to.be.revertedWithCustomError(rewarder, 'InsufficientAvailableBalance');
    await expect(rewarder.notifyReward(POOL_1, ethers.parseEther('4')))
      .to.emit(rewarder, 'NotifyReward')
      .withArgs(admin.address, POOL_1, epoch, ethers.parseEther('4'));
    await expect(rewarder.notifyReward(POOL_2, 0))
      .to.emit(rewarder, 'NotifyReward')
      .withArgs(admin.address, POOL_2, epoch, ethers.parseEther('6'));
    await expect(rewarder.notifyReward(POOL_1, 1)).to.be.revertedWithCustomError(rewarder, 'InsufficientAvailableBalance');

    await rewarder.setSigner(admin.address);
    const deadline = (await time.latest()) + 100;
    const signature = await signClaim(rewarder, admin, provider.address, ethers.parseEther('3'), deadline);
    await rewarder.connect(provider)['claim(uint256,uint256,bytes)'](ethers.parseEther('3'), deadline, signature);
    await nest.transfer(rewarder.target, ethers.parseEther('2'));
    await expect(rewarder.notifyReward(POOL_1, 0))
      .to.emit(rewarder, 'NotifyReward')
      .withArgs(admin.address, POOL_1, epoch, ethers.parseEther('2'));
    expect(await rewarder.totalRewardDistributed()).to.equal(ethers.parseEther('12'));
    expect(await rewarder.totalRewardClaimed()).to.equal(ethers.parseEther('3'));
    expect(await nest.balanceOf(rewarder.target)).to.equal(ethers.parseEther('9'));
    expect(await rewarder.rewardPerEpoch(epoch)).to.equal(ethers.parseEther('12'));
    expect(await rewarder.rewardPerPoolPerEpoch(epoch, POOL_1)).to.equal(ethers.parseEther('6'));
    expect(await rewarder.rewardPerPoolPerEpoch(epoch, POOL_2)).to.equal(ethers.parseEther('6'));
  });

  it('pulls approved NEST from an admin and rolls back when transfer fails', async () => {
    const { admin, operator, nest, rewarder } = await loadFixture(fixture);
    const amount = ethers.parseEther('5');
    const epoch = BigInt(Math.floor((await time.latest()) / WEEK) * WEEK);
    await expect(rewarder.notifyRewardWithTransfer(POOL_1, amount)).to.be.revertedWith('ERC20: insufficient allowance');
    await nest.approve(rewarder.target, amount);
    await expect(rewarder.notifyRewardWithTransfer(POOL_1, amount))
      .to.emit(rewarder, 'NotifyReward')
      .withArgs(admin.address, POOL_1, epoch, amount)
      .and.to.emit(nest, 'Transfer')
      .withArgs(admin.address, rewarder.target, amount);
    expect(await rewarder.totalRewardDistributed()).to.equal(amount);
    await expect(rewarder.notifyRewardWithTransfer(POOL_1, 0)).to.be.revertedWithCustomError(rewarder, 'ZeroRewardAmount');
    await rewarder.grantRole(await rewarder.DEFAULT_ADMIN_ROLE(), operator.address);
    await nest.mint(operator.address, amount);
    await nest.connect(operator).approve(rewarder.target, amount);
    await expect(rewarder.connect(operator).notifyRewardWithTransfer(POOL_2, amount))
      .to.emit(rewarder, 'NotifyReward')
      .withArgs(operator.address, POOL_2, epoch, amount);
    expect(await rewarder.totalRewardDistributed()).to.equal(amount * 2n);
    expect(await rewarder.rewardPerEpoch(epoch)).to.equal(amount * 2n);
    expect(await rewarder.rewardPerPoolPerEpoch(epoch, POOL_1)).to.equal(amount);
    expect(await rewarder.rewardPerPoolPerEpoch(epoch, POOL_2)).to.equal(amount);
  });

  it('rounds notification timestamps down to the current weekly epoch without a minter', async () => {
    const { admin, nest, rewarder } = await loadFixture(fixture);
    const epoch = BigInt(Math.floor((await time.latest()) / WEEK) * WEEK);
    const laterEpoch = epoch + BigInt(WEEK * 2);
    await nest.transfer(rewarder.target, ethers.parseEther('3'));
    await expect(rewarder.notifyReward(POOL_1, ethers.parseEther('1')))
      .to.emit(rewarder, 'NotifyReward')
      .withArgs(admin.address, POOL_1, epoch, ethers.parseEther('1'));

    await time.increaseTo(Number(laterEpoch) + 100);
    await expect(rewarder.notifyReward(POOL_1, ethers.parseEther('1')))
      .to.emit(rewarder, 'NotifyReward')
      .withArgs(admin.address, POOL_1, laterEpoch, ethers.parseEther('1'));
    await expect(rewarder.notifyReward(POOL_2, ethers.parseEther('1')))
      .to.emit(rewarder, 'NotifyReward')
      .withArgs(admin.address, POOL_2, laterEpoch, ethers.parseEther('1'));

    expect(await rewarder.rewardPerEpoch(epoch)).to.equal(ethers.parseEther('1'));
    expect(await rewarder.rewardPerEpoch(epoch + BigInt(WEEK))).to.equal(0);
    expect(await rewarder.rewardPerEpoch(laterEpoch)).to.equal(ethers.parseEther('2'));
    expect(await rewarder.rewardPerPoolPerEpoch(epoch, POOL_1)).to.equal(ethers.parseEther('1'));
    expect(await rewarder.rewardPerPoolPerEpoch(laterEpoch, POOL_1)).to.equal(ethers.parseEther('1'));
    expect(await rewarder.rewardPerPoolPerEpoch(laterEpoch, POOL_2)).to.equal(ethers.parseEther('1'));
  });

  it('pays only the increase in a provider’s signed cumulative entitlement', async () => {
    const { admin, provider, otherProvider, nest, rewarder } = await loadFixture(fixture);
    await nest.approve(rewarder.target, ethers.parseEther('10'));
    await rewarder.notifyRewardWithTransfer(POOL_1, ethers.parseEther('10'));
    await rewarder.setSigner(admin.address);
    let deadline = (await time.latest()) + 100;
    let signature = await signClaim(rewarder, admin, provider.address, ethers.parseEther('4'), deadline);
    await expect(rewarder.connect(provider)['claim(uint256,uint256,bytes)'](ethers.parseEther('4'), deadline, signature))
      .to.emit(rewarder, 'Claim')
      .withArgs(provider.address, ethers.parseEther('4'), ethers.parseEther('4'));
    await expect(
      rewarder.connect(provider)['claim(uint256,uint256,bytes)'](ethers.parseEther('4'), deadline, signature),
    ).to.be.revertedWithCustomError(rewarder, 'AlreadyClaimed');
    deadline = (await time.latest()) + 100;
    signature = await signClaim(rewarder, admin, provider.address, ethers.parseEther('7'), deadline);
    await expect(rewarder.connect(provider)['claim(uint256,uint256,bytes)'](ethers.parseEther('7'), deadline, signature))
      .to.emit(rewarder, 'Claim')
      .withArgs(provider.address, ethers.parseEther('3'), ethers.parseEther('7'));
    expect(await rewarder.claimed(provider.address)).to.equal(ethers.parseEther('7'));
    expect(await rewarder.totalRewardClaimed()).to.equal(ethers.parseEther('7'));
    expect(await nest.balanceOf(provider.address)).to.equal(ethers.parseEther('7'));

    const otherSignature = await signClaim(rewarder, admin, otherProvider.address, ethers.parseEther('4'), deadline);
    await expect(
      rewarder.connect(otherProvider)['claim(uint256,uint256,bytes)'](ethers.parseEther('4'), deadline, otherSignature),
    ).to.be.revertedWithCustomError(rewarder, 'InsufficientAvailableBalance');
    await nest.transfer(rewarder.target, ethers.parseEther('1'));
    await rewarder.notifyReward(POOL_1, ethers.parseEther('1'));
    await rewarder.connect(otherProvider)['claim(uint256,uint256,bytes)'](ethers.parseEther('4'), deadline, otherSignature);
    expect(await rewarder.totalRewardClaimed()).to.equal(ethers.parseEther('11'));
  });

  it('shares claim accounting across claim forms and enforces claimFor role', async () => {
    const { admin, provider, operator, nest, rewarder } = await loadFixture(fixture);
    await nest.approve(rewarder.target, ethers.parseEther('10'));
    await rewarder.notifyRewardWithTransfer(POOL_1, ethers.parseEther('10'));
    await rewarder.setSigner(admin.address);
    const deadline = (await time.latest()) + 100;
    const first = await signClaim(rewarder, admin, provider.address, ethers.parseEther('2'), deadline);
    await expect(
      rewarder['claimFor(address,uint256,uint256,bytes)'](provider.address, ethers.parseEther('2'), deadline, first),
    ).to.be.revertedWith(getAccessControlError(ethers.id('CLAMER_FOR_ROLE'), admin.address));
    await rewarder.grantRole(ethers.id('CLAMER_FOR_ROLE'), operator.address);
    await rewarder.connect(operator)['claimFor(address,uint256,uint256,bytes)'](provider.address, ethers.parseEther('2'), deadline, first);

    const identifier = ethers.id('LP position 1');
    const second = await signClaim(rewarder, admin, provider.address, ethers.parseEther('5'), deadline, identifier);
    await expect(rewarder.connect(provider)['claim(uint256,uint256,bytes32,bytes)'](ethers.parseEther('5'), deadline, identifier, second))
      .to.emit(rewarder, 'PositionClaim')
      .withArgs(provider.address, ethers.parseEther('3'), ethers.parseEther('5'), identifier);
    const third = await signClaim(rewarder, admin, provider.address, ethers.parseEther('6'), deadline, ethers.id('LP position 2'));
    await expect(
      rewarder
        .connect(operator)
        ['claimFor(address,uint256,uint256,bytes32,bytes)'](
          provider.address,
          ethers.parseEther('6'),
          deadline,
          ethers.id('LP position 2'),
          third,
        ),
    )
      .to.emit(rewarder, 'PositionClaim')
      .withArgs(provider.address, ethers.parseEther('1'), ethers.parseEther('6'), ethers.id('LP position 2'));
    expect(await rewarder.claimed(provider.address)).to.equal(ethers.parseEther('6'));
    expect(await rewarder.totalRewardClaimed()).to.equal(ethers.parseEther('6'));
  });

  it('rejects disabled, expired, invalid, cross-domain and overallocated claims', async () => {
    const { admin, provider, otherProvider, nest, rewarder } = await loadFixture(fixture);
    const deadline = (await time.latest()) + 100;
    const amount = ethers.parseEther('2');
    const claim = (signature: string) => rewarder.connect(provider)['claim(uint256,uint256,bytes)'](amount, deadline, signature);
    await expect(claim('0x')).to.be.revertedWithCustomError(rewarder, 'ClaimDisabled');
    await rewarder.setSigner(admin.address);
    const valid = await signClaim(rewarder, admin, provider.address, amount, deadline);
    await expect(rewarder.connect(provider)['claim(uint256,uint256,bytes)'](amount, 1, valid)).to.be.revertedWithCustomError(
      rewarder,
      'SignatureExpired',
    );
    const wrongUser = await signClaim(rewarder, admin, otherProvider.address, amount, deadline);
    await expect(claim(wrongUser)).to.be.revertedWithCustomError(rewarder, 'InvalidSignature');
    const wrongDomain = await signClaim(rewarder, admin, provider.address, amount, deadline, undefined, 'GaugeRewarder');
    await expect(claim(wrongDomain)).to.be.revertedWithCustomError(rewarder, 'InvalidSignature');
    await nest.transfer(rewarder.target, amount);
    await expect(claim(valid)).to.be.revertedWithCustomError(rewarder, 'InsufficientAvailableBalance');
    await rewarder.notifyReward(POOL_1, ethers.parseEther('1'));
    await expect(claim(valid)).to.be.revertedWithCustomError(rewarder, 'InsufficientAvailableBalance');
    await rewarder.notifyReward(POOL_1, ethers.parseEther('1'));
    await claim(valid);
    expect(await rewarder.totalRewardClaimed()).to.equal(amount);
  });
});
