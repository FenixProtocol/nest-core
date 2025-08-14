import { ethers } from 'hardhat';
import { GaugeType } from '../../utils/Constants';
import { AliasDeployedContracts, deploy } from '../../utils/Deploy';
import { InstanceName } from '../../utils/Names';

async function main() {
  const [deployer] = await ethers.getSigners();

  const Tasks = [
    {
      contract: InstanceName.BribeFactoryUpgradeable,
      saveAlias: AliasDeployedContracts.BribeFactoryUpgradeable_Implementation,
      constructorArguments: [],
    },
    {
      contract: InstanceName.BribeUpgradeable,
      saveAlias: AliasDeployedContracts.BribeUpgradeable_Implementation,
      constructorArguments: [],
    },
    {
      contract: InstanceName.GaugeFactoryUpgradeable,
      saveAlias: AliasDeployedContracts.GaugeFactoryUpgradeable_Implementation,
      constructorArguments: [],
    },
    {
      contract: InstanceName.MinterUpgradeable,
      saveAlias: AliasDeployedContracts.MinterUpgradeable_Implementation,
      constructorArguments: [],
    },
    {
      contract: InstanceName.NestRaiseUpgradeable,
      saveAlias: AliasDeployedContracts.NestRaiseUpgradeable_Implementation,
      constructorArguments: [],
    },
    {
      contract: InstanceName.VeNestDistributorUpgradeable,
      saveAlias: AliasDeployedContracts.VeNestDistributorUpgradeable_Implementation,
      constructorArguments: [],
    },
    {
      contract: InstanceName.VeNestSplitMerklAidropUpgradeable,
      saveAlias: AliasDeployedContracts.VeNestSplitMerklAidropUpgradeable_Implementation,
      constructorArguments: [],
    },
    {
      contract: InstanceName.VoterUpgradeable,
      saveAlias: AliasDeployedContracts.VoterUpgradeable_Implementation,
      constructorArguments: [],
    },
    {
      contract: InstanceName.VotingEscrowUpgradeable,
      saveAlias: AliasDeployedContracts.VotingEscrowUpgradeable_Implementation,
      constructorArguments: [],
    },
    {
      contract: InstanceName.Pair,
      saveAlias: AliasDeployedContracts.Pair_Implementation,
      constructorArguments: [],
    },
    {
      contract: InstanceName.SingelTokenVirtualRewarderUpgradeable,
      saveAlias: AliasDeployedContracts.SingelTokenVirtualRewarderUpgradeable_Implementation,
      constructorArguments: [],
    },
    {
      contract: InstanceName.CompoundVeNESTManagedNFTStrategyUpgradeable,
      saveAlias: AliasDeployedContracts.CompoundVeNESTManagedNFTStrategyUpgradeable_Implementation,
      constructorArguments: [],
    },
    {
      contract: InstanceName.CompoundVeNESTManagedNFTStrategyFactoryUpgradeable,
      saveAlias: AliasDeployedContracts.CompoundVeNESTManagedNFTStrategyFactoryUpgradeable_Implementation,
      constructorArguments: [],
    },
    {
      contract: InstanceName.RouterV2PathProviderUpgradeable,
      saveAlias: AliasDeployedContracts.RouterV2PathProviderUpgradeable_Implementation,
      constructorArguments: [],
    },
    {
      contract: InstanceName.ManagedNFTManagerUpgradeable,
      saveAlias: AliasDeployedContracts.ManagedNFTManagerUpgradeable_Implementation,
      constructorArguments: [],
    },
    {
      contract: InstanceName.PairAPIUpgradeable,
      saveAlias: AliasDeployedContracts.PairAPIUpgradeable_Implementation,
      constructorArguments: [],
    },
    {
      contract: InstanceName.RewardAPIUpgradeable,
      saveAlias: AliasDeployedContracts.RewardAPIUpgradeable_Implementation,
      constructorArguments: [],
    },
    {
      contract: InstanceName.VeNFTAPIUpgradeable,
      saveAlias: AliasDeployedContracts.VeNFTAPIUpgradeable_Implementation,
      constructorArguments: [],
    },
    {
      contract: InstanceName.UtilsUpgradeable,
      saveAlias: AliasDeployedContracts.UtilsUpgradeable_Implementation,
      constructorArguments: [],
    },
    {
      contract: InstanceName.BribeVeNESTRewardToken,
      saveAlias: AliasDeployedContracts.BribeVeNESTRewardToken_Implementation,
      constructorArguments: [],
    },
    {
      contract: InstanceName.CustomBribeRewardRouter,
      saveAlias: AliasDeployedContracts.CustomBribeRewardRouter_Implementation,
      constructorArguments: [],
    },
    {
      contract: InstanceName.GetInformationAggregatorUpgradeable,
      saveAlias: AliasDeployedContracts.GetInformationAggregatorUpgradeable_Implementation,
      constructorArguments: [],
    },
    {
      contract: InstanceName.UtilsUpgradeable,
      saveAlias: AliasDeployedContracts.UtilsUpgradeable_Implementation,
      constructorArguments: [],
    },
    {
      contract: InstanceName.PairFactoryUpgradeable,
      saveAlias: AliasDeployedContracts.PairFactoryUpgradeable_Implementation,
      constructorArguments: [],
    },
    {
      contract: InstanceName.FeesVaultFactoryUpgradeable,
      saveAlias: AliasDeployedContracts.FeesVaultFactoryUpgradeable_Implementation,
      constructorArguments: [],
    },
    {
      contract: InstanceName.FeesVaultUpgradeable,
      saveAlias: AliasDeployedContracts.FeesVaultUpgradeable_Implementation,
      constructorArguments: [],
    },
    {
      contract: InstanceName.GaugeUpgradeable,
      saveAlias: AliasDeployedContracts.GaugeUpgradeable_V2Pools_Implementation,
      constructorArguments: [GaugeType.V2PairsGauge],
    },
    {
      contract: InstanceName.GaugeUpgradeable,
      saveAlias: AliasDeployedContracts.GaugeUpgradeable_V3Pools_Implementation,
      constructorArguments: [GaugeType.V3PairsGauge],
    },
    {
      contract: InstanceName.GaugeRewarder,
      saveAlias: AliasDeployedContracts.GaugeRewader_Implementation,
      constructorArguments: [],
    },
    {
      contract: InstanceName.CompoundEmissionExtensionUpgradeable,
      saveAlias: AliasDeployedContracts.CompoundEmissionExtensionUpgradeable_Implementation,
      constructorArguments: [],
    },
  ];

  for await (const task of Tasks) {
    await deploy({
      name: task.contract,
      deployer: deployer,
      constructorArguments: task.constructorArguments,
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
