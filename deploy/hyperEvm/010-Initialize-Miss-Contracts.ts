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

async function main() {
  const [deployer] = await ethers.getSigners();

  const DeployedContracts = await getDeployedContractsAddressList();

  // const NestRaiseUpgradeable_Proxy = await ethers.getContractAt(
  //   "NestRaiseUpgradeable",
  //   DeployedContracts[AliasDeployedContracts.NestRaiseUpgradeable_Proxy],
  // );

  // await logTx(
  //   NestRaiseUpgradeable_Proxy,
  //   NestRaiseUpgradeable_Proxy.initialize(
  //     "0x5555555555555555555555555555555555555555",
  //     "0x07c57E32a3C29D5659bda1d3EFC2E7BF004E3035",
  //     deployer,
  //     ethers.parseEther('1'),
  //     DeployedContracts[AliasDeployedContracts.VoterUpgradeable_Proxy],
  //     ethers.parseEther('1')
  //   ),
  // );

  // const VoterUpgradeable_Proxy = await ethers.getContractAt(
  //   InstanceName.VoterUpgradeable,
  //   DeployedContracts[AliasDeployedContracts.VoterUpgradeable_Proxy],
  // );

  // await logTx(VoterUpgradeable_Proxy, VoterUpgradeable_Proxy.updateAddress('v3PoolFactory', '0xF77Bd082c627aA54591cF2f2EaA811fd1AB3b1F3'));
    const FeesVaultFactoryUpgradeable_Proxy = await ethers.getContractAt(
    InstanceName.FeesVaultFactoryUpgradeable,
    DeployedContracts[AliasDeployedContracts.FeesVaultFactoryUpgradeable_Proxy],
  );
  
  await logTx(
    FeesVaultFactoryUpgradeable_Proxy,
    FeesVaultFactoryUpgradeable_Proxy.grantRole(
      await FeesVaultFactoryUpgradeable_Proxy.WHITELISTED_CREATOR_ROLE(),
      '0xF77Bd082c627aA54591cF2f2EaA811fd1AB3b1F3',
    ),
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
