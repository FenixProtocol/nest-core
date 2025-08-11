import { AliasDeployedContracts, deploy, deployProxy } from '../../utils/Deploy';
import { ethers } from 'hardhat';
import { InstanceName } from '../../utils/Names';
import { GaugeType } from '../../utils/Constants';

async function main() {
  const [deployer] = await ethers.getSigners();

  await deploy({
    name: InstanceName.ProxyAdmin,
    deployer: deployer,
    constructorArguments: [],
    saveAlias: AliasDeployedContracts.ProxyAdmin,
    verify: false,
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
