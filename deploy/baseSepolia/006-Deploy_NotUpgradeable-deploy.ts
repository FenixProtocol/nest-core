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

async function main() {
  const [deployer] = await ethers.getSigners();
  const DeployedContracts = await getDeployedContractsAddressList();

  const Tasks = [
    {
      contract: InstanceName.RouterV2,
      saveAlias: AliasDeployedContracts.RouterV2,
      constructorArguments: [
        DeployedContracts[AliasDeployedContracts.PairFactoryUpgradeable_Proxy],
        '0x4200000000000000000000000000000000000006',
      ],
    },
    {
      contract: InstanceName.UniswapV2PartialRouter,
      saveAlias: AliasDeployedContracts.UniswapV2PartialRouter,
      constructorArguments: [
        DeployedContracts[AliasDeployedContracts.PairFactoryUpgradeable_Proxy],
        '0x4200000000000000000000000000000000000006',
      ],
    },
  ];
  for await (const task of Tasks) {
    let contract = await deploy({
      name: task.contract,
      deployer: deployer,
      constructorArguments: task.constructorArguments,
      saveAlias: task.saveAlias,
      verify: false,
    });
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
