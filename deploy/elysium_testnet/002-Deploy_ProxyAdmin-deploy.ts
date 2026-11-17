import { deploy } from '../../utils/Deploy';
import { AliasDeployedContracts, InstanceName } from '../../utils/Names';
import { getDeploymentContext } from './_shared';

async function main() {
  const { deployer } = await getDeploymentContext();

  await deploy({
    name: InstanceName.ProxyAdmin,
    deployer,
    constructorArguments: [],
    saveAlias: AliasDeployedContracts.ProxyAdmin,
    verify: true,
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
