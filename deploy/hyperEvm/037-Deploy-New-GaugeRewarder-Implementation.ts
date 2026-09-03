import { ethers } from 'hardhat';
import { AliasDeployedContracts, deploy } from '../../utils/Deploy';
import { InstanceName } from '../../utils/Names';

async function main() {
  const [deployer] = await ethers.getSigners();

  await deploy({
    name: InstanceName.GaugeRewarder,
    deployer,
    constructorArguments: [],
    saveAlias: AliasDeployedContracts.GaugeRewader_Implementation,
    verify: true,
  });

  console.log('\nGaugeRewarder implementation deployed\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
