import { ethers } from 'hardhat';
import { AliasDeployedContracts, deploy, getDeployedContractsAddressList, getProxyAdminAddress, logTx } from '../../utils/Deploy';
import { InstanceName } from '../../utils/Names';
import { CompoundVeNESTManagedNFTStrategyFactoryUpgradeable } from '../../typechain-types';

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
    return typedStrategy;
  }

async function main() {
  const DeployedContracts = await getDeployedContractsAddressList();

  const Factory = await ethers.getContractAt(
    InstanceName.CompoundVeNESTManagedNFTStrategyFactoryUpgradeable,
    DeployedContracts[AliasDeployedContracts.CompoundVeNESTManagedNFTStrategyFactoryUpgradeable_Proxy],
  );
  
  const ManagedNFTManagerUpgradeable = await ethers.getContractAt(
      InstanceName.ManagedNFTManagerUpgradeable,
      DeployedContracts[AliasDeployedContracts.ManagedNFTManagerUpgradeable_Proxy],
  );
  const initialStrategies = [
    {
      name: 'HYPE Engine Vault',
      creator: 'nest',
      description: 'This vault compounds 100% of fees into veNEST and receives exclusive MEGAHYPE rewards.',
      delayDettachCooldown: 345600,
      authorizedAddress: "0x0e07a5efa3baebf2e569243760d8358e3ff20482"
    }
  ];

  for (const strategyData of initialStrategies) {
    let strategy=  await createStategy(Factory, strategyData.name, strategyData.creator, strategyData.description);
    await logTx(strategy, strategy.setDetachmentLockDuration(strategyData.delayDettachCooldown));
    await logTx(ManagedNFTManagerUpgradeable, ManagedNFTManagerUpgradeable.setAuthorizedUser(1, strategyData.authorizedAddress));
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
