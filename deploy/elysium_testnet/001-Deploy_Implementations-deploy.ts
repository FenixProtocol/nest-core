import { AliasDeployedContracts, deploy } from '../../utils/Deploy';
import { InstanceName } from '../../utils/Names';
import { getDeploymentContext } from './_shared';

async function main() {
  const { deployer } = await getDeploymentContext();

  const tasks = [
    {
      contract: InstanceName.Pair,
      saveAlias: AliasDeployedContracts.Pair_Implementation,
    },
    {
      contract: InstanceName.FeesVaultUpgradeable,
      saveAlias: AliasDeployedContracts.FeesVaultUpgradeable_Implementation,
    },
    {
      contract: InstanceName.FeesVaultFactoryUpgradeable,
      saveAlias: AliasDeployedContracts.FeesVaultFactoryUpgradeable_Implementation,
    },
    {
      contract: InstanceName.PairFactoryUpgradeable,
      saveAlias: AliasDeployedContracts.PairFactoryUpgradeable_Implementation,
    },
  ];

  for (const task of tasks) {
    await deploy({
      name: task.contract,
      deployer,
      constructorArguments: [],
      saveAlias: task.saveAlias,
      verify: true,
    });
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
