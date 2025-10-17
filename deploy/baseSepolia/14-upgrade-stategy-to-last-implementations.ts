import { ethers } from 'hardhat';
import { GaugeType } from '../../utils/Constants';
import { AliasDeployedContracts, deploy, deployProxy, getDeployedContractsAddressList, getProxyAdminAddress } from '../../utils/Deploy';
import { InstanceName } from '../../utils/Names';

async function main() {
  const [deployer] = await ethers.getSigners();

  const DeployedContracts = await getDeployedContractsAddressList();
  const ProxyAdmin = await getProxyAdminAddress();

  let strategyNewImplementation = await deploy({
      name: InstanceName.CompoundVeNESTManagedNFTStrategyUpgradeable,
      deployer: deployer,
      constructorArguments: [],
      saveAlias: "CompoundVeNESTManagedNFTStrategyUpgradeable_Implementation",
      verify: false,
  });

  let managerImpl = await deploy({
      name: InstanceName.ManagedNFTManagerUpgradeable,
      deployer: deployer,
      constructorArguments: [],
      saveAlias: AliasDeployedContracts.ManagedNFTManagerUpgradeable_Implementation,
      verify: false,
  });

  let StrategyFactory = await ethers.getContractAt(InstanceName.CompoundVeNESTManagedNFTStrategyFactoryUpgradeable, DeployedContracts[AliasDeployedContracts.CompoundVeNESTManagedNFTStrategyFactoryUpgradeable_Proxy])
  await StrategyFactory.changeStrategyImplementation(strategyNewImplementation);
  
  let ProxyAdmin_Typed = await ethers.getContractAt("ProxyAdmin", ProxyAdmin);
  await ProxyAdmin_Typed.upgrade(DeployedContracts[AliasDeployedContracts.ManagedNFTManagerUpgradeable_Proxy], managerImpl);

  let UpgradeaUtils = await ethers.getContractAt(InstanceName.UtilsUpgradeable, DeployedContracts[AliasDeployedContracts.UtilsUpgradeable_Proxy])

  await UpgradeaUtils.multiUpgradeCall(["0x1C0717f3A3f833Af760f9D4a6b10A8228361C2ab", "0x2dd4430a028598cc770b36ac2041801f6a420196", "0x90f780ca033562fcfb0d8ae7491684a8b0472ce7", "0x15a476c3ed515ff831fb9e46609745fb52ded336", "0xb38685767b9fa7f9e8d7b5a6d5a2b4e1e8117599"]);

  let strategy = await ethers.getContractAt("CompoundVeNESTManagedNFTStrategyUpgradeable", "0x1C0717f3A3f833Af760f9D4a6b10A8228361C2ab");
  await strategy.setDetachmentLockDuration(86400);
  
  strategy = await ethers.getContractAt("CompoundVeNESTManagedNFTStrategyUpgradeable", "0x2dd4430a028598cc770b36ac2041801f6a420196");
  await strategy.setDetachmentLockDuration(7200);

  strategy = await ethers.getContractAt("CompoundVeNESTManagedNFTStrategyUpgradeable", "0x90f780ca033562fcfb0d8ae7491684a8b0472ce7");
  await strategy.setDetachmentLockDuration(172800);

5
  let managerProxy = await ethers.getContractAt(InstanceName.ManagedNFTManagerUpgradeable, DeployedContracts[AliasDeployedContracts.ManagedNFTManagerUpgradeable_Proxy]);

  await managerProxy.setDefaultDetachmentLockDuration(3600);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
