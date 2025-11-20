import { ethers } from 'hardhat';
import { AliasDeployedContracts, deploy, getDeployedContractsAddressList, getProxyAdminAddress, logTx } from '../../utils/Deploy';
import { InstanceName } from '../../utils/Names';

async function main() {
  const DeployedContracts = await getDeployedContractsAddressList();

  const MinterUpgradeable_Proxy = await ethers.getContractAt(
    InstanceName.MinterUpgradeable,
    DeployedContracts[AliasDeployedContracts.MinterUpgradeable_Proxy],
  );
  
  await logTx(MinterUpgradeable_Proxy, MinterUpgradeable_Proxy.start());

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
