import { SnapshotRestorer, takeSnapshot } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { StandardMerkleTree } from '@openzeppelin/merkle-tree';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { ERC20Mock, WHypeAirdrop } from '../../typechain-types';
import { ERRORS, getAccessControlError } from '../utils/constants';

type TreeEntry = [string, bigint];

function getProof(tree: StandardMerkleTree<(string | bigint)[]>, account: string, amount: bigint): string[] {
  for (const [index, value] of tree.entries()) {
    const entry = value as TreeEntry;
    if (entry[0] === account && entry[1] === amount) {
      return tree.getProof(index);
    }
  }

  return [];
}

describe('WHypeAirdrop', function () {
  let snapshot: SnapshotRestorer;
  let deployer: HardhatEthersSigner;
  let proxyAdmin: HardhatEthersSigner;
  let user: HardhatEthersSigner;
  let otherUser: HardhatEthersSigner;
  let recipient: HardhatEthersSigner;
  let whype: ERC20Mock;
  let airdrop: WHypeAirdrop;

  before(async () => {
    [deployer, proxyAdmin, user, otherUser, recipient] = await ethers.getSigners();

    whype = (await ethers.deployContract('ERC20Mock', ['Wrapped HYPE', 'WHYPE', 18])) as ERC20Mock;
    const implementation = (await ethers.deployContract('WHypeAirdrop', [])) as WHypeAirdrop;
    const proxy = await ethers.deployContract('TransparentUpgradeableProxy', [implementation.target, proxyAdmin.address, '0x']);
    airdrop = (await ethers.getContractAt('WHypeAirdrop', proxy.target)) as WHypeAirdrop;

    await airdrop.initialize(whype.target);
    snapshot = await takeSnapshot();
  });

  afterEach(async () => {
    await snapshot.restore();
  });

  describe('claim of WHYPE tokens', function () {
    it('Must revert if contract is paused', async () => {
      const amount = ethers.parseEther('10');
      const tree = StandardMerkleTree.of([[user.address, amount]], ['address', 'uint256']);

      await airdrop.setRootHash(tree.root);
      await whype.mint(airdrop.target, amount);
      await airdrop.pause();

      await expect(airdrop.connect(user).claim(getProof(tree, user.address, amount), user.address, amount)).to.be.revertedWith(
        ERRORS.Pausable.Paused,
      );
    });

    it('Must revert claim because of wrong passed address', async () => {
      const amount = ethers.parseEther('10');
      const tree = StandardMerkleTree.of([[user.address, amount]], ['address', 'uint256']);

      await airdrop.setRootHash(tree.root);
      await whype.mint(airdrop.target, amount);

      await expect(
        airdrop.connect(otherUser).claim(getProof(tree, user.address, amount), otherUser.address, amount),
      ).to.be.revertedWithCustomError(airdrop, 'InvalidMerkleProof');
    });

    it('Must revert claim because of wrong passed amount', async () => {
      const amount = ethers.parseEther('10');
      const wrongAmount = ethers.parseEther('11');
      const tree = StandardMerkleTree.of([[user.address, amount]], ['address', 'uint256']);

      await airdrop.setRootHash(tree.root);
      await whype.mint(airdrop.target, wrongAmount);

      await expect(airdrop.connect(user).claim(getProof(tree, user.address, amount), user.address, wrongAmount)).to.be.revertedWithCustomError(
        airdrop,
        'InvalidMerkleProof',
      );
    });

    it('Must revert claim because of insufficient HYPE token balance', async () => {
      const amount = ethers.parseEther('10');
      const tree = StandardMerkleTree.of([[user.address, amount]], ['address', 'uint256']);

      await airdrop.setRootHash(tree.root);
      await whype.mint(airdrop.target, amount - 1n);

      await expect(airdrop.connect(user).claim(getProof(tree, user.address, amount), user.address, amount)).to.be.revertedWith(
        ERRORS.ERC20.InsufficientBalance,
      );
    });

    it('Must revert claim because it was already claimed', async () => {
      const amount = ethers.parseEther('10');
      const tree = StandardMerkleTree.of([[user.address, amount]], ['address', 'uint256']);

      await airdrop.setRootHash(tree.root);
      await whype.mint(airdrop.target, amount);
      await airdrop.connect(user).claim(getProof(tree, user.address, amount), user.address, amount);

      await expect(airdrop.connect(user).claim(getProof(tree, user.address, amount), user.address, amount)).to.be.revertedWithCustomError(
        airdrop,
        'AlreadyClaimed',
      );
    });

    it('Must successfully claim and emit event', async () => {
      const amount = ethers.parseEther('10');
      const tree = StandardMerkleTree.of([[user.address, amount]], ['address', 'uint256']);

      await airdrop.setRootHash(tree.root);
      await whype.mint(airdrop.target, amount);

      await expect(airdrop.connect(user).claim(getProof(tree, user.address, amount), user.address, amount))
        .to.emit(airdrop, 'Claimed')
        .withArgs(user.address, amount, amount);
      expect(await whype.balanceOf(user.address)).to.eq(amount);
    });

    it('Must successfully claim after root hash update with increased amount for already claimed user', async () => {
      const firstAmount = ethers.parseEther('10');
      const secondAmount = ethers.parseEther('15');
      const treeRound1 = StandardMerkleTree.of([[user.address, firstAmount]], ['address', 'uint256']);
      const treeRound2 = StandardMerkleTree.of([[user.address, secondAmount]], ['address', 'uint256']);

      await whype.mint(airdrop.target, secondAmount);
      await airdrop.setRootHash(treeRound1.root);
      await airdrop.connect(user).claim(getProof(treeRound1, user.address, firstAmount), user.address, firstAmount);

      await airdrop.setRootHash(treeRound2.root);
      await expect(airdrop.connect(user).claim(getProof(treeRound2, user.address, secondAmount), user.address, secondAmount))
        .to.emit(airdrop, 'Claimed')
        .withArgs(user.address, secondAmount, secondAmount - firstAmount);

      expect(await airdrop.claimed(user.address)).to.eq(secondAmount);
      expect(await whype.balanceOf(user.address)).to.eq(secondAmount);
    });
  });

  describe('whype root update', function () {
    it("Must revert if user doesn't have role", async () => {
      const root = ethers.keccak256(ethers.toUtf8Bytes('root-1'));

      await expect(airdrop.connect(user).setRootHash(root)).to.be.revertedWith(
        getAccessControlError(await airdrop.ROOT_SETTER_ROLE(), user.address),
      );
    });

    it('Must revert if contract is paused', async () => {
      const root = ethers.keccak256(ethers.toUtf8Bytes('root-1'));

      await airdrop.pause();

      await expect(airdrop.setRootHash(root)).to.be.revertedWith(ERRORS.Pausable.Paused);
    });

    it('Must revert if user passed zero bytes32', async () => {
      await expect(airdrop.setRootHash(ethers.ZeroHash)).to.be.revertedWithCustomError(airdrop, 'ZeroRootHash');
    });

    it('Must successfully update root hash and emit event', async () => {
      const root = ethers.keccak256(ethers.toUtf8Bytes('root-1'));

      await expect(airdrop.setRootHash(root)).to.emit(airdrop, 'RootHashUpdated').withArgs(root);
      expect(await airdrop.rootHash()).to.eq(root);
    });
  });

  describe('emergency recover ERC20', function () {
    it("Must revert if user doesn't have role", async () => {
      await airdrop.pause();
      await whype.mint(airdrop.target, ethers.parseEther('1'));

      await expect(
        airdrop.connect(user).emergencyRecoverERC20(whype.target, recipient.address, ethers.parseEther('1')),
      ).to.be.revertedWith(getAccessControlError(await airdrop.DEFAULT_ADMIN_ROLE(), user.address));
    });

    it("Must revert if contract isn't paused", async () => {
      await whype.mint(airdrop.target, ethers.parseEther('1'));
      await expect(airdrop.emergencyRecoverERC20(whype.target, recipient.address, ethers.parseEther('1'))).to.be.revertedWith(
        ERRORS.Pausable.NotPaused,
      );
    });

    it('Must revert if passed amount is greater than actual one', async () => {
      await airdrop.pause();
      await whype.mint(airdrop.target, ethers.parseEther('1'));
      await expect(airdrop.emergencyRecoverERC20(whype.target, recipient.address, ethers.parseEther('2'))).to.be.revertedWith(
        ERRORS.ERC20.InsufficientBalance,
      );
    });
  });

  describe('pausable', function () {
    it("Must revert to pause contract if user doesn't have role", async () => {
      await expect(airdrop.connect(user).pause()).to.be.revertedWith(
        getAccessControlError(await airdrop.DEFAULT_ADMIN_ROLE(), user.address),
      );
    });

    it("Must revert to unpause contract if user doesn't have role", async () => {
      await airdrop.pause();
      await expect(airdrop.connect(user).unpause()).to.be.revertedWith(
        getAccessControlError(await airdrop.DEFAULT_ADMIN_ROLE(), user.address),
      );
    });
  });
});
