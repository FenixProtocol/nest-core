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

async function main() {
  const [deployer] = await ethers.getSigners();

  const DeployedContracts = await getDeployedContractsAddressList();
  const proxy = await ethers.getContractAt(
    InstanceName.CompoundVeNESTManagedNFTStrategyFactoryUpgradeable,
    DeployedContracts[AliasDeployedContracts.CompoundVeNESTManagedNFTStrategyFactoryUpgradeable_Proxy],
  );

  const defs = [
    // 3/5 from Nest Protocol
    {
      name: 'veNEST: Max NEST Rewards',
      creator: 'Nest Protocol',
      description: 'Auto-compounds NEST emissions to maximize veNEST voting power and rewards.',
    },
    {
      name: 'veNEST: Stable LP Booster',
      creator: 'Nest Protocol',
      description: 'Focuses on stable pairs; compounds swap fees + NEST rewards back into veNEST.',
    },
    {
      name: 'veNEST: Core Pairs Accumulator',
      creator: 'Nest Protocol',
      description: 'Targets core NEST pairs (e.g., NEST/WETH) with conservative compounding cadence.',
    },
    // 2 non-Nest examples (same pattern as aerodrome "nest" strategies, just different creator)
    {
      name: 'veNEST: Community Auto-Compounder',
      creator: 'Community Strategy',
      description: 'General-purpose compounding for DAO-managed vaults with moderate risk profile.',
    },
    {
      name: 'veNEST: Risk-On Yield Maximizer',
      creator: 'Labs',
      description: 'Aggressive rotation across higher-yield pools; faster reinvest frequency.',
    },
  ];

  for (const d of defs) {
    await createStategy(proxy, d.name, d.creator, d.description);
  }
}

async function createStategy(
  CompoundVeNESTManagedNFTStrategyFactoryUpgradeable_Proxy: CompoundVeNESTManagedNFTStrategyFactoryUpgradeable,
  name: string,
  creator: string,
  description: string,
) {
  const strategy = await CompoundVeNESTManagedNFTStrategyFactoryUpgradeable_Proxy.createStrategy.staticCall(name);
  await logTx(
    CompoundVeNESTManagedNFTStrategyFactoryUpgradeable_Proxy,
    CompoundVeNESTManagedNFTStrategyFactoryUpgradeable_Proxy.createStrategy(name),
  );
  let typedStrategy = await ethers.getContractAt(InstanceName.CompoundVeNESTManagedNFTStrategyUpgradeable, strategy);
  await logTx(typedStrategy, typedStrategy.setCreator(creator));
  await logTx(typedStrategy, typedStrategy.setDescription(description));

  const DeployedContracts = await getDeployedContractsAddressList();

  const proxy = await ethers.getContractAt(
    InstanceName.ManagedNFTManagerUpgradeable,
    DeployedContracts[AliasDeployedContracts.ManagedNFTManagerUpgradeable_Proxy],
  );

  await logTx(proxy, proxy.createManagedNFT(typedStrategy));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
