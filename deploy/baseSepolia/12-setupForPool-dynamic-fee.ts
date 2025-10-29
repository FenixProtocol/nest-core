import { ethers } from 'hardhat';
import { GaugeType } from '../../utils/Constants';
import { AliasDeployedContracts, deploy, deployProxy, getDeployedContractsAddressList, getProxyAdminAddress } from '../../utils/Deploy';
import { InstanceName } from '../../utils/Names';
import { time } from '@nomicfoundation/hardhat-toolbox/network-helpers';

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

  let ProxyAdmin_Typed = await ethers.getContractAt("ProxyAdmin", ProxyAdmin);
  await ProxyAdmin_Typed.upgrade("0xAD5813254AEFEE06340C5DdAA831b91e598A9d3e", implementation);

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
