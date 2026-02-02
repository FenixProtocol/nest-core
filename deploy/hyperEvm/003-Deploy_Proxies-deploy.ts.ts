import { AliasDeployedContracts, deploy, deployProxy, getDeployedContractsAddressList, getProxyAdminAddress } from '../../utils/Deploy';
import { ethers } from 'hardhat';

async function main() {
  const [deployer] = await ethers.getSigners();

  const ProxyAdmin = await getProxyAdminAddress();
  const DeployedContracts = await getDeployedContractsAddressList();

  const Tasks = [
    {
      logic: DeployedContracts[AliasDeployedContracts.BribeFactoryUpgradeable_Implementation],
      saveAlias: AliasDeployedContracts.BribeFactoryUpgradeable_Proxy,
    },
    {
      logic: DeployedContracts[AliasDeployedContracts.GaugeFactoryUpgradeable_Implementation],
      saveAlias: AliasDeployedContracts.GaugeFactory_V2Pools_Proxy,
    },
    {
      logic: DeployedContracts[AliasDeployedContracts.GaugeFactoryUpgradeable_Implementation],
      saveAlias: AliasDeployedContracts.GaugeFactory_V3Pools_Proxy,
    },
    {
      logic: DeployedContracts[AliasDeployedContracts.MinterUpgradeable_Implementation],
      saveAlias: AliasDeployedContracts.MinterUpgradeable_Proxy,
    },
    {
      logic: DeployedContracts[AliasDeployedContracts.NestRaiseUpgradeable_Implementation],
      saveAlias: AliasDeployedContracts.NestRaiseUpgradeable_Proxy,
    },
    {
      logic: DeployedContracts[AliasDeployedContracts.VeNestDistributorUpgradeable_Implementation],
      saveAlias: AliasDeployedContracts.VeNestDistributorUpgradeable_Proxy,
    },
    {
      logic: DeployedContracts[AliasDeployedContracts.VeNestSplitMerklAirdropUpgradeable_Implementation],
      saveAlias: AliasDeployedContracts.VeNestSplitMerklAirdropUpgradeable_Proxy,
    },
    {
      logic: DeployedContracts[AliasDeployedContracts.VoterUpgradeable_Implementation],
      saveAlias: AliasDeployedContracts.VoterUpgradeable_Proxy,
    },
    {
      logic: DeployedContracts[AliasDeployedContracts.VotingEscrowUpgradeable_Implementation],
      saveAlias: AliasDeployedContracts.VotingEscrowUpgradeable_Proxy,
    },
    {
      logic: DeployedContracts[AliasDeployedContracts.CompoundVeNESTManagedNFTStrategyFactoryUpgradeable_Implementation],
      saveAlias: AliasDeployedContracts.CompoundVeNESTManagedNFTStrategyFactoryUpgradeable_Proxy,
    },
    {
      logic: DeployedContracts[AliasDeployedContracts.RouterV2PathProviderUpgradeable_Implementation],
      saveAlias: AliasDeployedContracts.RouterV2PathProviderUpgradeable_Proxy,
    },
    {
      logic: DeployedContracts[AliasDeployedContracts.ManagedNFTManagerUpgradeable_Implementation],
      saveAlias: AliasDeployedContracts.ManagedNFTManagerUpgradeable_Proxy,
    },
    {
      logic: DeployedContracts[AliasDeployedContracts.PairAPIUpgradeable_Implementation],
      saveAlias: AliasDeployedContracts.PairAPIUpgradeable_Proxy,
    },
    {
      logic: DeployedContracts[AliasDeployedContracts.RewardAPIUpgradeable_Implementation],
      saveAlias: AliasDeployedContracts.RewardAPIUpgradeable_Proxy,
    },
    {
      logic: DeployedContracts[AliasDeployedContracts.VeNFTAPIUpgradeable_Implementation],
      saveAlias: AliasDeployedContracts.VeNFTAPIUpgradeable_Proxy,
    },
    {
      logic: DeployedContracts[AliasDeployedContracts.BribeVeNESTRewardToken_Implementation],
      saveAlias: AliasDeployedContracts.BribeVeNESTRewardToken_Proxy,
    },
    {
      logic: DeployedContracts[AliasDeployedContracts.CustomBribeRewardRouter_Implementation],
      saveAlias: AliasDeployedContracts.CustomBribeRewardRouter_Proxy,
    },
    {
      logic: DeployedContracts[AliasDeployedContracts.GetInformationAggregatorUpgradeable_Implementation],
      saveAlias: AliasDeployedContracts.GetInformationAggregatorUpgradeable_Proxy,
    },
    {
      logic: DeployedContracts[AliasDeployedContracts.UtilsUpgradeable_Implementation],
      saveAlias: AliasDeployedContracts.UtilsUpgradeable_Proxy,
    },
    {
      logic: DeployedContracts[AliasDeployedContracts.PairFactoryUpgradeable_Implementation],
      saveAlias: AliasDeployedContracts.PairFactoryUpgradeable_Proxy,
    },
    {
      logic: DeployedContracts[AliasDeployedContracts.FeesVaultFactoryUpgradeable_Implementation],
      saveAlias: AliasDeployedContracts.FeesVaultFactoryUpgradeable_Proxy,
    },
    {
      logic: DeployedContracts[AliasDeployedContracts.GaugeRewader_Implementation],
      saveAlias: AliasDeployedContracts.GaugeRewader_Proxy,
    },
    {
      logic: DeployedContracts[AliasDeployedContracts.CompoundEmissionExtensionUpgradeable_Implementation],
      saveAlias: AliasDeployedContracts.CompoundEmissionExtensionUpgradeable_Proxy,
    },
  ];

  for await (const task of Tasks) {
    await deployProxy({
      logic: task.logic,
      deployer: deployer,
      admin: ProxyAdmin,
      saveAlias: task.saveAlias,
      verify: false,
    });
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
