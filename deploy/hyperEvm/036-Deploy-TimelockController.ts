import { ethers, network } from 'hardhat';
import { AliasDeployedContracts, deploy } from '../../utils/Deploy';
import { InstanceName } from '../../utils/Names';

const ONE_DAY = 24 * 60 * 60;
const TIMELOCK_ROLE_RECIPIENT = '0x6652173b0Cb3d96d8f0198bc49670440Dec69e79';

async function main() {
  if (!ethers.isAddress(TIMELOCK_ROLE_RECIPIENT) || TIMELOCK_ROLE_RECIPIENT === ethers.ZeroAddress) {
    throw new Error('Set TIMELOCK_ROLE_RECIPIENT to the proposer, executor, and admin address before running this script.');
  }

  const [deployer] = await ethers.getSigners();
  const roleRecipient = ethers.getAddress(TIMELOCK_ROLE_RECIPIENT);

  await deploy({
    name: InstanceName.TimelockController,
    deployer,
    constructorArguments: [ONE_DAY, [roleRecipient], [roleRecipient], roleRecipient],
    saveAlias: AliasDeployedContracts.TimelockController,
    verify: true,
  });

  console.log('\nTimelockController deployed\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
