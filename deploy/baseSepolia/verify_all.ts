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
import { GetInformationAddressKey } from '../../utils/Constants';
import { CompoundVeNESTManagedNFTStrategyFactoryUpgradeable } from '../../typechain-types';
import { WEEK } from '../../test/utils/constants';

async function main() {
  const [deployer] = await ethers.getSigners();

  const DeployedContracts = await getDeployedContractsAddressList();
  const Nest = await ethers.getContractAt(InstanceName.Nest, DeployedContracts[AliasDeployedContracts.Nest]);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
