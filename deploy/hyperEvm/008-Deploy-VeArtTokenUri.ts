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
import { ART_RPOXY_PARTS } from '../../utils/ArtProxy';

async function main() {
  const [deployer] = await ethers.getSigners();

  const DeployedContracts = await getDeployedContractsAddressList();

  const VotingEscrowUpgradeable_Proxy = await ethers.getContractAt(
    InstanceName.VotingEscrowUpgradeable,
    DeployedContracts[AliasDeployedContracts.VotingEscrowUpgradeable_Proxy],
  );

  const ManagedNFTManagerUpgradeable_Proxy = await ethers.getContractAt(
    InstanceName.ManagedNFTManagerUpgradeable,
    DeployedContracts[AliasDeployedContracts.ManagedNFTManagerUpgradeable_Proxy],
  );
  const staticProxy = await deploy({
    name: InstanceName.VeArtProxyStatic,
    deployer: deployer,
    constructorArguments: [],
    saveAlias: AliasDeployedContracts.VeArtProxyStatic,
    verify: false,
  });

  let staticProxyTyped = await ethers.getContractAt(InstanceName.VeArtProxyStatic, staticProxy);

  await logTx(staticProxyTyped, staticProxyTyped.setStartPart(ART_RPOXY_PARTS.startPart));
  await logTx(staticProxyTyped, staticProxyTyped.setEndPart(ART_RPOXY_PARTS.endPart));

  const VeArtProxy = await deploy({
    name: InstanceName.VeArtProxy,
    deployer: deployer,
    constructorArguments: [staticProxy, VotingEscrowUpgradeable_Proxy, ManagedNFTManagerUpgradeable_Proxy],
    saveAlias: AliasDeployedContracts.VeArtProxy,
    verify: false,
  });

  await logTx(VotingEscrowUpgradeable_Proxy, VotingEscrowUpgradeable_Proxy.updateAddress('artProxy', VeArtProxy));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
