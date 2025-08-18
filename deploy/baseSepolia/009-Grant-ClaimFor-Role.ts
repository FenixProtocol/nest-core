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

  const VoterUpgradeable_Proxy = await ethers.getContractAt(
    InstanceName.VoterUpgradeable,
    DeployedContracts[AliasDeployedContracts.VoterUpgradeable_Proxy],
  );

  const GaugeRewader_Proxy = await ethers.getContractAt(
    InstanceName.GaugeRewarder,
    DeployedContracts[AliasDeployedContracts.GaugeRewader_Proxy],
  );

  await logTx(GaugeRewader_Proxy, GaugeRewader_Proxy.grantRole(ethers.id('CLAMER_FOR_ROLE'), VoterUpgradeable_Proxy));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
