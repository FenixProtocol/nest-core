import { ethers } from 'hardhat';
import { AliasDeployedContracts, deploy, getDeployedContractsAddressList, getProxyAdminAddress, logTx } from '../../utils/Deploy';
import { InstanceName } from '../../utils/Names';

async function main() {
  const [deployer] = await ethers.getSigners();

  const DeployedContracts = await getDeployedContractsAddressList();
  const ProxyAdmin = await getProxyAdminAddress();

  let newImplementation = await deploy({
      name: InstanceName.MinterUpgradeable,
      deployer: deployer,
      constructorArguments: [],
      saveAlias: AliasDeployedContracts.MinterUpgradeable_Implementation,
      verify: true,
  });

  let ProxyAdmin_Typed = await ethers.getContractAt(InstanceName.ProxyAdmin, ProxyAdmin);
  await logTx(ProxyAdmin_Typed, ProxyAdmin_Typed.upgrade(DeployedContracts[AliasDeployedContracts.MinterUpgradeable_Proxy], newImplementation));

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
