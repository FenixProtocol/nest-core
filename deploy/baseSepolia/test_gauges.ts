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

  const PairFactoryUpgradeable = await ethers.getContractAt(
    InstanceName.PairFactoryUpgradeable,
    DeployedContracts[AliasDeployedContracts.PairFactoryUpgradeable_Proxy],
  );

  const VoterUpgradeable_Proxy = await ethers.getContractAt(
    InstanceName.VoterUpgradeable,
    DeployedContracts[AliasDeployedContracts.VoterUpgradeable_Proxy],
  );
  const list = [
    DeployedContracts['ERC20_FakeUSDT'],
    DeployedContracts['ERC20_FakeUSDC'],
    DeployedContracts['ERC20_FakeWBTC'],
    DeployedContracts['ERC20_TOK18'],
    DeployedContracts['ERC20_TOK9'],
    DeployedContracts['ERC20_FakeUniV2'],
    DeployedContracts['Nest'],
  ];

  let pairs = await PairFactoryUpgradeable.pairs();

  for await (const pair of pairs) {
    await logTx(VoterUpgradeable_Proxy, VoterUpgradeable_Proxy.createV2Gauge(pair));
  }

  await logTx(VoterUpgradeable_Proxy, VoterUpgradeable_Proxy.createV3Gauge('0xb44cb122e35e86043d9888c94a37cb418468eccf'));
  await logTx(VoterUpgradeable_Proxy, VoterUpgradeable_Proxy.createV3Gauge('0x27408844caf2ba6ddcfeb7f77b1b5f84705f5b6c'));
  await logTx(VoterUpgradeable_Proxy, VoterUpgradeable_Proxy.createV3Gauge('0xe8854c59f74b953a0ebe94e185d40f25468e4ea0'));
  await logTx(VoterUpgradeable_Proxy, VoterUpgradeable_Proxy.createV3Gauge('0x5dba01011eacb98e988ae81305d5252d29ccdc10'));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
