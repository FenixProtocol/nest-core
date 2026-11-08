import { ethers } from 'hardhat';
import { AliasDeployedContracts, getDeployedContractsAddressList } from '../../utils/Deploy';
import { InstanceName } from '../../utils/Names';
import { getDeploymentContext, requireDeploymentAddress } from './_shared';

async function main() {
  const { deployer } = await getDeploymentContext();
  const deployments = await getDeployedContractsAddressList();
  const factoryAddress = requireDeploymentAddress(deployments, AliasDeployedContracts.PairFactoryUpgradeable_Proxy);

  if ((await ethers.provider.getCode(factoryAddress)) === '0x') {
    throw new Error(`No PairFactory contract at ${factoryAddress}`);
  }

  const factory = await ethers.getContractAt(InstanceName.PairFactoryUpgradeable, factoryAddress, deployer);
  if (await factory.isPublicPoolCreationMode()) {
    console.log(`Public pool creation is already enabled on PairFactory ${factoryAddress}`);
    return;
  }

  const administratorRole = await factory.PAIRS_ADMINISTRATOR_ROLE();
  if (!(await factory.hasRole(administratorRole, deployer.address))) {
    throw new Error(`Deployer ${deployer.address} lacks PAIRS_ADMINISTRATOR_ROLE`);
  }

  const tx = await factory.setIsPublicPoolCreationMode(true);
  console.log(`Enabling public pool creation on PairFactory ${factoryAddress}: ${tx.hash}`);
  await tx.wait();

  if (!(await factory.isPublicPoolCreationMode())) {
    throw new Error('Public pool creation is still disabled after the transaction');
  }
  console.log('Public pool creation enabled.');
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
