import { ethers, network } from 'hardhat';
import { AliasDeployedContracts, deploy } from '../../../utils/Deploy';
import { InstanceName } from '../../../utils/Names';
import { verify } from '../../../utils/Verify';

async function main() {
  if (network.name !== 'hyperEvm') {
    throw new Error('This script must be run with --network hyperEvm');
  }

  const [deployer] = await ethers.getSigners();
  const implementations = [
    {
      name: InstanceName.GaugeRewarder,
      saveAlias: AliasDeployedContracts.GaugeRewader_Implementation,
    },
    {
      name: InstanceName.VoterUpgradeable,
      saveAlias: AliasDeployedContracts.VoterUpgradeable_Implementation,
    },
    {
      name: InstanceName.CompoundEmissionExtensionUpgradeable,
      saveAlias: AliasDeployedContracts.CompoundEmissionExtensionUpgradeable_Implementation,
    },
  ];

  for (const implementation of implementations) {
    const contract = await deploy({
      name: implementation.name,
      deployer,
      constructorArguments: [],
      saveAlias: implementation.saveAlias,
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
