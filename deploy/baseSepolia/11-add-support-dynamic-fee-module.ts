import { ethers } from 'hardhat';
import { GaugeType } from '../../utils/Constants';
import { AliasDeployedContracts, deploy, deployProxy, getDeployedContractsAddressList, getProxyAdminAddress } from '../../utils/Deploy';
import { InstanceName } from '../../utils/Names';

async function main() {
  const [deployer] = await ethers.getSigners();

  const DeployedContracts = await getDeployedContractsAddressList();
  const ProxyAdmin = await getProxyAdminAddress();

  let implementation = await deploy({
      name: InstanceName.VolatileDynamicFeeOnePool,
      deployer: deployer,
      constructorArguments: [],
      saveAlias: "VolatileDynamicFeeOnePool_Implementation",
      verify: true,
  });

  await deployProxy({
        logic: (await implementation.getAddress()),
        deployer: deployer,
        admin: ProxyAdmin,
        saveAlias: "VolatileDynamicFeeOnePool_Proxy",
        verify: false,
  });


  let implFactry = await deploy({
      name: InstanceName.PairFactoryUpgradeable,
      deployer: deployer,
      constructorArguments: [],
      saveAlias: AliasDeployedContracts.PairFactoryUpgradeable_Implementation,
      verify: true,
  });

  let ProxyAdmin_Typed = await ethers.getContractAt("ProxyAdmin", ProxyAdmin);
  await ProxyAdmin_Typed.upgrade(DeployedContracts[AliasDeployedContracts.PairFactoryUpgradeable_Proxy], implFactry);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
