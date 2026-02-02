import { ethers } from 'hardhat';
import { AliasDeployedContracts, getDeployedContractsAddressList, logTx } from '../../utils/Deploy';
import { InstanceName } from '../../utils/Names';

async function main() {
  let TARGET_OWNERSHIP = "0x6652173b0Cb3d96d8f0198bc49670440Dec69e79";
  let OLD_OWNERSHIP = "0x5339E2BB6d07bc0E82D56E99FA669256c9596A4F";
  const DeployedContracts = await getDeployedContractsAddressList();
  const DEFAULT_ADMIN_ROLE = ethers.ZeroHash;

  {
    let ProxyAdmin = await ethers.getContractAt(InstanceName.ProxyAdmin, DeployedContracts[AliasDeployedContracts.ProxyAdmin]);
    await logTx(ProxyAdmin, ProxyAdmin.transferOwnership(TARGET_OWNERSHIP));
  }

  {
    let CustomBribeRewardRouter_Proxy = await ethers.getContractAt(InstanceName.CustomBribeRewardRouter, DeployedContracts[AliasDeployedContracts.CustomBribeRewardRouter_Proxy]);
    await logTx(CustomBribeRewardRouter_Proxy, CustomBribeRewardRouter_Proxy.grantRole(DEFAULT_ADMIN_ROLE, TARGET_OWNERSHIP));
    await logTx(CustomBribeRewardRouter_Proxy, CustomBribeRewardRouter_Proxy.renounceRole(DEFAULT_ADMIN_ROLE, OLD_OWNERSHIP));
  }

  {
    let BribeVeNESTRewardToken_Proxy = await ethers.getContractAt(InstanceName.BribeVeNESTRewardToken, DeployedContracts[AliasDeployedContracts.BribeVeNESTRewardToken_Proxy]);
    await logTx(BribeVeNESTRewardToken_Proxy, BribeVeNESTRewardToken_Proxy.grantRole(DEFAULT_ADMIN_ROLE, TARGET_OWNERSHIP));
    await logTx(BribeVeNESTRewardToken_Proxy, BribeVeNESTRewardToken_Proxy.renounceRole(DEFAULT_ADMIN_ROLE, OLD_OWNERSHIP));
  }

  {
    let BribeFactoryUpgradeable_Proxy = await ethers.getContractAt(InstanceName.BribeFactoryUpgradeable, DeployedContracts[AliasDeployedContracts.BribeFactoryUpgradeable_Proxy]);
    await logTx(BribeFactoryUpgradeable_Proxy, BribeFactoryUpgradeable_Proxy.transferOwnership(TARGET_OWNERSHIP));
  }

  {
    let PairAPIUpgradeable_Proxy = await ethers.getContractAt(InstanceName.PairAPIUpgradeable, DeployedContracts[AliasDeployedContracts.PairAPIUpgradeable_Proxy]);
    await logTx(PairAPIUpgradeable_Proxy, PairAPIUpgradeable_Proxy.transferOwnership(TARGET_OWNERSHIP));
  }

  {
    let RewardAPIUpgradeable_Proxy = await ethers.getContractAt(InstanceName.RewardAPIUpgradeable, DeployedContracts[AliasDeployedContracts.RewardAPIUpgradeable_Proxy]);
    await logTx(RewardAPIUpgradeable_Proxy, RewardAPIUpgradeable_Proxy.transferOwnership(TARGET_OWNERSHIP));
  }

  {
    let VeNFTAPIUpgradeable_Proxy = await ethers.getContractAt(InstanceName.VeNFTAPIUpgradeable, DeployedContracts[AliasDeployedContracts.VeNFTAPIUpgradeable_Proxy]);
    await logTx(VeNFTAPIUpgradeable_Proxy, VeNFTAPIUpgradeable_Proxy.transferOwnership(TARGET_OWNERSHIP));
  }

  {
    let PairFactoryUpgradeable_Proxy = await ethers.getContractAt(InstanceName.PairFactoryUpgradeable, DeployedContracts[AliasDeployedContracts.PairFactoryUpgradeable_Proxy]);
    await logTx(PairFactoryUpgradeable_Proxy, PairFactoryUpgradeable_Proxy.grantRole(DEFAULT_ADMIN_ROLE, TARGET_OWNERSHIP));
    await logTx(PairFactoryUpgradeable_Proxy, PairFactoryUpgradeable_Proxy.grantRole(await PairFactoryUpgradeable_Proxy.FEES_MANAGER_ROLE(), OLD_OWNERSHIP));
    await logTx(PairFactoryUpgradeable_Proxy, PairFactoryUpgradeable_Proxy.renounceRole(DEFAULT_ADMIN_ROLE, OLD_OWNERSHIP));
  }

  {
    let VolatileDynamicFeeOnePool_Proxy = await ethers.getContractAt(InstanceName.VolatileDynamicFeeOnePool, DeployedContracts[AliasDeployedContracts.VolatileDynamicFeeOnePool_Proxy]);
    await logTx(VolatileDynamicFeeOnePool_Proxy, VolatileDynamicFeeOnePool_Proxy.transferOwnership(TARGET_OWNERSHIP));
  }

  {
    let FeesVaultFactoryUpgradeable_Proxy = await ethers.getContractAt(InstanceName.FeesVaultFactoryUpgradeable, DeployedContracts[AliasDeployedContracts.FeesVaultFactoryUpgradeable_Proxy]);
    await logTx(FeesVaultFactoryUpgradeable_Proxy, FeesVaultFactoryUpgradeable_Proxy.grantRole(DEFAULT_ADMIN_ROLE, TARGET_OWNERSHIP));
    await logTx(FeesVaultFactoryUpgradeable_Proxy, FeesVaultFactoryUpgradeable_Proxy.renounceRole(DEFAULT_ADMIN_ROLE, OLD_OWNERSHIP));
  }

  {
    let GaugeFactory_V2Pools_Proxy = await ethers.getContractAt(InstanceName.GaugeFactoryUpgradeable, DeployedContracts[AliasDeployedContracts.GaugeFactory_V2Pools_Proxy]);
    await logTx(GaugeFactory_V2Pools_Proxy, GaugeFactory_V2Pools_Proxy.transferOwnership(TARGET_OWNERSHIP));
  }

  {
    let GaugeFactory_V3Pools_Proxy = await ethers.getContractAt(InstanceName.GaugeFactoryUpgradeable, DeployedContracts[AliasDeployedContracts.GaugeFactory_V3Pools_Proxy]);
    await logTx(GaugeFactory_V3Pools_Proxy, GaugeFactory_V3Pools_Proxy.transferOwnership(TARGET_OWNERSHIP));
  }

  {
    let ManagedNFTManagerUpgradeable_Proxy = await ethers.getContractAt(InstanceName.ManagedNFTManagerUpgradeable, DeployedContracts[AliasDeployedContracts.ManagedNFTManagerUpgradeable_Proxy]);
    await logTx(ManagedNFTManagerUpgradeable_Proxy, ManagedNFTManagerUpgradeable_Proxy.renounceRole(await ManagedNFTManagerUpgradeable_Proxy.MANAGED_NFT_ADMIN(), OLD_OWNERSHIP));
    await logTx(ManagedNFTManagerUpgradeable_Proxy, ManagedNFTManagerUpgradeable_Proxy.grantRole(DEFAULT_ADMIN_ROLE, TARGET_OWNERSHIP));
    await logTx(ManagedNFTManagerUpgradeable_Proxy, ManagedNFTManagerUpgradeable_Proxy.renounceRole(DEFAULT_ADMIN_ROLE, OLD_OWNERSHIP));
  }

  {
    let CompoundVeNESTManagedNFTStrategyFactoryUpgradeable_Proxy = await ethers.getContractAt(InstanceName.CompoundVeNESTManagedNFTStrategyFactoryUpgradeable, DeployedContracts[AliasDeployedContracts.CompoundVeNESTManagedNFTStrategyFactoryUpgradeable_Proxy]);
    await logTx(CompoundVeNESTManagedNFTStrategyFactoryUpgradeable_Proxy, CompoundVeNESTManagedNFTStrategyFactoryUpgradeable_Proxy.renounceRole(await CompoundVeNESTManagedNFTStrategyFactoryUpgradeable_Proxy.STRATEGY_CREATOR_ROLE(), OLD_OWNERSHIP));
    await logTx(CompoundVeNESTManagedNFTStrategyFactoryUpgradeable_Proxy, CompoundVeNESTManagedNFTStrategyFactoryUpgradeable_Proxy.grantRole(DEFAULT_ADMIN_ROLE, TARGET_OWNERSHIP));
    await logTx(CompoundVeNESTManagedNFTStrategyFactoryUpgradeable_Proxy, CompoundVeNESTManagedNFTStrategyFactoryUpgradeable_Proxy.renounceRole(DEFAULT_ADMIN_ROLE, OLD_OWNERSHIP));
  }

  {
    let RouterV2PathProviderUpgradeable_Proxy = await ethers.getContractAt(InstanceName.RouterV2PathProviderUpgradeable, DeployedContracts[AliasDeployedContracts.RouterV2PathProviderUpgradeable_Proxy]);
    await logTx(RouterV2PathProviderUpgradeable_Proxy, RouterV2PathProviderUpgradeable_Proxy.transferOwnership(TARGET_OWNERSHIP));
  }

  {
    let GaugeRewader_Proxy = await ethers.getContractAt(InstanceName.GaugeRewarder, DeployedContracts[AliasDeployedContracts.GaugeRewader_Proxy]);
    await logTx(GaugeRewader_Proxy, GaugeRewader_Proxy.grantRole(DEFAULT_ADMIN_ROLE, TARGET_OWNERSHIP));
    // Rewarder role
    await logTx(GaugeRewader_Proxy, GaugeRewader_Proxy.renounceRole("0xbeec13769b5f410b0584f69811bfd923818456d5edcf426b0e31cf90eed7a3f6", OLD_OWNERSHIP));

    await logTx(GaugeRewader_Proxy, GaugeRewader_Proxy.renounceRole(DEFAULT_ADMIN_ROLE, OLD_OWNERSHIP));
  }

  {
    let NestRaiseUpgradeable_Proxy = await ethers.getContractAt(InstanceName.NestRaiseUpgradeable, DeployedContracts[AliasDeployedContracts.NestRaiseUpgradeable_Proxy]);
    await logTx(NestRaiseUpgradeable_Proxy, NestRaiseUpgradeable_Proxy.transferOwnership(TARGET_OWNERSHIP));
  }

  {
    let VeNestDistributorUpgradeable_Proxy = await ethers.getContractAt(InstanceName.VeNestDistributorUpgradeable, DeployedContracts[AliasDeployedContracts.VeNestDistributorUpgradeable_Proxy]);
    // DISTRIBUTOR_ROLE
    await logTx(VeNestDistributorUpgradeable_Proxy, VeNestDistributorUpgradeable_Proxy.renounceRole("0xfbd454f36a7e1a388bd6fc3ab10d434aa4578f811acbbcf33afb1c697486313c", OLD_OWNERSHIP));
    // WITHDRAWER_ROLE
    await logTx(VeNestDistributorUpgradeable_Proxy, VeNestDistributorUpgradeable_Proxy.renounceRole("0x10dac8c06a04bec0b551627dad28bc00d6516b0caacd1c7b345fcdb5211334e4", OLD_OWNERSHIP));
    await logTx(VeNestDistributorUpgradeable_Proxy, VeNestDistributorUpgradeable_Proxy.grantRole(DEFAULT_ADMIN_ROLE, TARGET_OWNERSHIP));
    await logTx(VeNestDistributorUpgradeable_Proxy, VeNestDistributorUpgradeable_Proxy.renounceRole(DEFAULT_ADMIN_ROLE, OLD_OWNERSHIP));
  }

  {
    let VeNestSplitMerklAirdropUpgradeable_Proxy = await ethers.getContractAt(InstanceName.VeNestSplitMerklAirdropUpgradeable, DeployedContracts[AliasDeployedContracts.VeNestSplitMerklAirdropUpgradeable_Proxy]);
    await logTx(VeNestSplitMerklAirdropUpgradeable_Proxy, VeNestSplitMerklAirdropUpgradeable_Proxy.transferOwnership(TARGET_OWNERSHIP));
  }

  {
    let VoterUpgradeable_Proxy = await ethers.getContractAt(InstanceName.VoterUpgradeable, DeployedContracts[AliasDeployedContracts.VoterUpgradeable_Proxy]);
    // VOTER_ADMIN_ROLE
    await logTx(VoterUpgradeable_Proxy, VoterUpgradeable_Proxy.renounceRole("0xdb77e4a0d65a915fbfe630f3ac05f3a2259b73e7baead93657155a1e625c8b5e", OLD_OWNERSHIP));
    await logTx(VoterUpgradeable_Proxy, VoterUpgradeable_Proxy.grantRole(DEFAULT_ADMIN_ROLE, TARGET_OWNERSHIP));
    await logTx(VoterUpgradeable_Proxy, VoterUpgradeable_Proxy.renounceRole(DEFAULT_ADMIN_ROLE, OLD_OWNERSHIP));
  }

  {
    let VotingEscrowUpgradeable_Proxy = await ethers.getContractAt(InstanceName.VotingEscrowUpgradeable, DeployedContracts[AliasDeployedContracts.VotingEscrowUpgradeable_Proxy]);
    await logTx(VotingEscrowUpgradeable_Proxy, VotingEscrowUpgradeable_Proxy.transferOwnership(TARGET_OWNERSHIP));
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
