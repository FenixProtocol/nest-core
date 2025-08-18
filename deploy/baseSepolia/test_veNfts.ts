import {
  AliasDeployedContracts,
  deploy,
  deployProxy,
  getDeployedContractsAddressList,
  getProxyAdminAddress,
  logTx,
} from '../../utils/Deploy';
import { ethers } from 'hardhat';
import { InstanceName } from '../../utils/Names';
import { GetInformationAddressKey } from '../../utils/Constants';
import { CompoundVeNESTManagedNFTStrategyFactoryUpgradeable } from '../../typechain-types';
import { WEEK } from '../../test/utils/constants';

async function main() {
  const [deployer] = await ethers.getSigners();

  const DeployedContracts = await getDeployedContractsAddressList();
  const Nest = await ethers.getContractAt(InstanceName.Nest, DeployedContracts[AliasDeployedContracts.Nest]);

  const VotingEscrowUpgradeable = await ethers.getContractAt(
    InstanceName.VotingEscrowUpgradeable,
    DeployedContracts[AliasDeployedContracts.VotingEscrowUpgradeable_Proxy],
  );

  await logTx(Nest, Nest.approve(VotingEscrowUpgradeable, ethers.MaxUint256));

  await logTx(VotingEscrowUpgradeable, VotingEscrowUpgradeable.createLockFor(ethers.parseEther('1'), WEEK * 2, deployer, false, false, 0));

  await logTx(VotingEscrowUpgradeable, VotingEscrowUpgradeable.createLockFor(ethers.parseEther('10'), WEEK * 8, deployer, false, true, 0));
  await logTx(
    VotingEscrowUpgradeable,
    VotingEscrowUpgradeable.createLockFor(ethers.parseEther('20'), WEEK * 16, deployer, false, false, 0),
  );
  await logTx(VotingEscrowUpgradeable, VotingEscrowUpgradeable.createLockFor(ethers.parseEther('40'), WEEK * 32, deployer, false, true, 0));

  await logTx(VotingEscrowUpgradeable, VotingEscrowUpgradeable.createLockFor(ethers.parseEther('100'), 0, deployer, false, true, 1));
  await logTx(VotingEscrowUpgradeable, VotingEscrowUpgradeable.createLockFor(ethers.parseEther('1000'), 0, deployer, false, true, 2));
  await logTx(
    VotingEscrowUpgradeable,
    VotingEscrowUpgradeable.createLockFor(ethers.parseEther('6000'), WEEK * 2, deployer, false, false, 3),
  );
  await logTx(VotingEscrowUpgradeable, VotingEscrowUpgradeable.createLockFor(ethers.parseEther('7000'), 0, deployer, false, true, 4));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
