import { ethers } from 'hardhat';
import { AliasDeployedContracts, getDeployedContractsAddressList, logTx } from '../../utils/Deploy';
import { InstanceName } from '../../utils/Names';
import { deploy } from '../../utils/Deploy';

async function main() {
  const [deployer] = await ethers.getSigners();

  const Tasks = [{
      contract: InstanceName.VotingEscrowUpgradeable,
      saveAlias: AliasDeployedContracts.VotingEscrowUpgradeable_Implementation,
      constructorArguments: [],
    }
  ]

  for await (const task of Tasks) {
    await deploy({
      name: task.contract,
      deployer: deployer,
      constructorArguments: task.constructorArguments,
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
