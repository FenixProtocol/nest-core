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

async function main() {
  const [deployer] = await ethers.getSigners();

  const DeployedContracts = await getDeployedContractsAddressList();

  const MinterUpgradeable_Proxy = await ethers.getContractAt(
    InstanceName.MinterUpgradeable,
    DeployedContracts[AliasDeployedContracts.MinterUpgradeable_Proxy],
  );

  const VotingEscrowUpgradeable_Proxy = await ethers.getContractAt(
    InstanceName.VotingEscrowUpgradeable,
    DeployedContracts[AliasDeployedContracts.VotingEscrowUpgradeable_Proxy],
  );

  const VoterUpgradeable_Proxy = await ethers.getContractAt(
    InstanceName.VoterUpgradeable,
    DeployedContracts[AliasDeployedContracts.VoterUpgradeable_Proxy],
  );

  const Nest = await ethers.getContractAt(InstanceName.Nest, DeployedContracts[AliasDeployedContracts.Nest]);

  const BribeFactoryUpgradeable_Proxy = await ethers.getContractAt(
    InstanceName.BribeFactoryUpgradeable,
    DeployedContracts[AliasDeployedContracts.BribeFactoryUpgradeable_Proxy],
  );

  const GetInformationAggregatorUpgradeable_Proxy = await ethers.getContractAt(
    InstanceName.GetInformationAggregatorUpgradeable,
    DeployedContracts[AliasDeployedContracts.GetInformationAggregatorUpgradeable_Proxy],
  );

  const PairAPIUpgradeable_Proxy = await ethers.getContractAt(
    InstanceName.PairAPIUpgradeable,
    DeployedContracts[AliasDeployedContracts.PairAPIUpgradeable_Proxy],
  );

  const RewardAPIUpgradeable_Proxy = await ethers.getContractAt(
    InstanceName.RewardAPIUpgradeable,
    DeployedContracts[AliasDeployedContracts.RewardAPIUpgradeable_Proxy],
  );

  const UtilsUpgradeable_Proxy = await ethers.getContractAt(
    InstanceName.UtilsUpgradeable,
    DeployedContracts[AliasDeployedContracts.UtilsUpgradeable_Proxy],
  );

  const VeNFTAPIUpgradeable_Proxy = await ethers.getContractAt(
    InstanceName.VeNFTAPIUpgradeable,
    DeployedContracts[AliasDeployedContracts.VeNFTAPIUpgradeable_Proxy],
  );

  const CompoundVeNESTManagedNFTStrategyFactoryUpgradeable_Proxy = await ethers.getContractAt(
    InstanceName.CompoundVeNESTManagedNFTStrategyFactoryUpgradeable,
    DeployedContracts[AliasDeployedContracts.CompoundVeNESTManagedNFTStrategyFactoryUpgradeable_Proxy],
  );

  const BribeVeNESTRewardToken_Proxy = await ethers.getContractAt(
    InstanceName.BribeVeNESTRewardToken,
    DeployedContracts[AliasDeployedContracts.BribeVeNESTRewardToken_Proxy],
  );

  const CustomBribeRewardRouter_Proxy = await ethers.getContractAt(
    InstanceName.CustomBribeRewardRouter,
    DeployedContracts[AliasDeployedContracts.CustomBribeRewardRouter_Proxy],
  );

  const RouterV2PathProviderUpgradeable_Proxy = await ethers.getContractAt(
    InstanceName.RouterV2PathProviderUpgradeable,
    DeployedContracts[AliasDeployedContracts.RouterV2PathProviderUpgradeable_Proxy],
  );

  const ManagedNFTManagerUpgradeable_Proxy = await ethers.getContractAt(
    InstanceName.ManagedNFTManagerUpgradeable,
    DeployedContracts[AliasDeployedContracts.ManagedNFTManagerUpgradeable_Proxy],
  );

  const GaugeFactory_V2Pools_Proxy = await ethers.getContractAt(
    InstanceName.GaugeFactoryUpgradeable,
    DeployedContracts[AliasDeployedContracts.GaugeFactory_V2Pools_Proxy],
  );

  const GaugeFactory_V3Pools_Proxy = await ethers.getContractAt(
    InstanceName.GaugeFactoryUpgradeable,
    DeployedContracts[AliasDeployedContracts.GaugeFactory_V3Pools_Proxy],
  );

  const FeesVaultFactoryUpgradeable_Proxy = await ethers.getContractAt(
    InstanceName.FeesVaultFactoryUpgradeable,
    DeployedContracts[AliasDeployedContracts.FeesVaultFactoryUpgradeable_Proxy],
  );

  const PairFactoryUpgradeable_Proxy = await ethers.getContractAt(
    InstanceName.PairFactoryUpgradeable,
    DeployedContracts[AliasDeployedContracts.PairFactoryUpgradeable_Proxy],
  );

  const VeNestDistributorUpgradeable_Proxy = await ethers.getContractAt(
    InstanceName.VeNestDistributorUpgradeable,
    DeployedContracts[AliasDeployedContracts.VeNestDistributorUpgradeable_Proxy],
  );

  const VeNestSplitMerklAirdropUpgradeable_Proxy = await ethers.getContractAt(
    InstanceName.VeNestSplitMerklAirdropUpgradeable,
    DeployedContracts[AliasDeployedContracts.VeNestSplitMerklAirdropUpgradeable_Proxy],
  );

  const NestRaiseUpgradeable_Proxy = await ethers.getContractAt(
    InstanceName.NestRaiseUpgradeable,
    DeployedContracts[AliasDeployedContracts.NestRaiseUpgradeable_Proxy],
  );

  const GaugeRewader_Proxy = await ethers.getContractAt(
    InstanceName.GaugeRewarder,
    DeployedContracts[AliasDeployedContracts.GaugeRewader_Proxy],
  );

  const CompoundEmissionExtensionUpgradeable_Proxy = await ethers.getContractAt(
    InstanceName.CompoundEmissionExtensionUpgradeable,
    DeployedContracts[AliasDeployedContracts.CompoundEmissionExtensionUpgradeable_Proxy],
  );

  await logTx(VotingEscrowUpgradeable_Proxy, VotingEscrowUpgradeable_Proxy.initialize(Nest));

  await logTx(
    VotingEscrowUpgradeable_Proxy,
    VotingEscrowUpgradeable_Proxy.updateAddress('managedNFTManager', ManagedNFTManagerUpgradeable_Proxy),
  );
  await logTx(VotingEscrowUpgradeable_Proxy, VotingEscrowUpgradeable_Proxy.updateAddress('voter', VoterUpgradeable_Proxy));
  await logTx(
    VotingEscrowUpgradeable_Proxy,
    VotingEscrowUpgradeable_Proxy.updateAddress('customBribeRewardRouter', CustomBribeRewardRouter_Proxy),
  );

  await logTx(VoterUpgradeable_Proxy, VoterUpgradeable_Proxy.initialize(VotingEscrowUpgradeable_Proxy));

  await logTx(VoterUpgradeable_Proxy, VoterUpgradeable_Proxy.grantRole(ethers.id('GOVERNANCE_ROLE'), deployer));

  await logTx(VoterUpgradeable_Proxy, VoterUpgradeable_Proxy.grantRole(ethers.id('VOTER_ADMIN_ROLE'), deployer));

  await logTx(VoterUpgradeable_Proxy, VoterUpgradeable_Proxy.updateAddress('minter', MinterUpgradeable_Proxy));
  await logTx(VoterUpgradeable_Proxy, VoterUpgradeable_Proxy.updateAddress('bribeFactory', BribeFactoryUpgradeable_Proxy));
  await logTx(VoterUpgradeable_Proxy, VoterUpgradeable_Proxy.updateAddress('gaugeRewarder', GaugeRewader_Proxy));

  await logTx(VoterUpgradeable_Proxy, VoterUpgradeable_Proxy.updateAddress('veNestMerklAidrop', VeNestSplitMerklAirdropUpgradeable_Proxy));
  await logTx(VoterUpgradeable_Proxy, VoterUpgradeable_Proxy.updateAddress('managedNFTManager', ManagedNFTManagerUpgradeable_Proxy));
  await logTx(VoterUpgradeable_Proxy, VoterUpgradeable_Proxy.updateAddress('v2PoolFactory', PairFactoryUpgradeable_Proxy));
  // For future upgrade await logTx(VoterUpgradeable_Proxy, VoterUpgradeable_Proxy.updateAddress('v3PoolFactory', '0x9F72Fdf5678289661DE009edCeFA1D255940Aa7b'));

  await logTx(VoterUpgradeable_Proxy, VoterUpgradeable_Proxy.updateAddress('v2GaugeFactory', GaugeFactory_V2Pools_Proxy));
  await logTx(VoterUpgradeable_Proxy, VoterUpgradeable_Proxy.updateAddress('v3GaugeFactory', GaugeFactory_V3Pools_Proxy));
  await logTx(
    VoterUpgradeable_Proxy,
    VoterUpgradeable_Proxy.updateAddress('compoundEmissionExtension', CompoundEmissionExtensionUpgradeable_Proxy),
  );

  await logTx(MinterUpgradeable_Proxy, MinterUpgradeable_Proxy.initialize(VoterUpgradeable_Proxy, VotingEscrowUpgradeable_Proxy));

  await logTx(BribeVeNESTRewardToken_Proxy, BribeVeNESTRewardToken_Proxy.initialize(VotingEscrowUpgradeable_Proxy));

  await logTx(
    CustomBribeRewardRouter_Proxy,
    CustomBribeRewardRouter_Proxy.initialize(VoterUpgradeable_Proxy, BribeVeNESTRewardToken_Proxy),
  );

  await logTx(
    BribeVeNESTRewardToken_Proxy,
    BribeVeNESTRewardToken_Proxy.grantRole(await BribeVeNESTRewardToken_Proxy.MINTER_ROLE(), CustomBribeRewardRouter_Proxy.target),
  );

  await logTx(
    CustomBribeRewardRouter_Proxy,
    CustomBribeRewardRouter_Proxy.setupFuncEnable(CustomBribeRewardRouter_Proxy.notifyRewardNESTInVeNEST.fragment.selector, true),
  );

  await logTx(
    CustomBribeRewardRouter_Proxy,
    CustomBribeRewardRouter_Proxy.setupFuncEnable(CustomBribeRewardRouter_Proxy.notifyRewardVeNESTInVeNest.fragment.selector, true),
  );

  await logTx(
    BribeFactoryUpgradeable_Proxy,
    BribeFactoryUpgradeable_Proxy.initialize(
      VoterUpgradeable_Proxy,
      DeployedContracts[AliasDeployedContracts.BribeUpgradeable_Implementation],
    ),
  );

  await logTx(
    BribeFactoryUpgradeable_Proxy,
    BribeFactoryUpgradeable_Proxy.pushDefaultRewardToken(DeployedContracts[AliasDeployedContracts.Nest]),
  );

  await logTx(
    GaugeFactory_V2Pools_Proxy,
    GaugeFactory_V2Pools_Proxy.initialize(
      VoterUpgradeable_Proxy,
      DeployedContracts[AliasDeployedContracts.GaugeUpgradeable_V2Pools_Implementation],
      GaugeRewader_Proxy,
    ),
  );
  await logTx(
    GaugeFactory_V3Pools_Proxy,
    GaugeFactory_V3Pools_Proxy.initialize(
      VoterUpgradeable_Proxy,
      DeployedContracts[AliasDeployedContracts.GaugeUpgradeable_V3Pools_Implementation],
      GaugeRewader_Proxy,
    ),
  );
  await logTx(
    ManagedNFTManagerUpgradeable_Proxy,
    ManagedNFTManagerUpgradeable_Proxy.initialize(VotingEscrowUpgradeable_Proxy, VoterUpgradeable_Proxy),
  );

  await logTx(
    FeesVaultFactoryUpgradeable_Proxy,
    FeesVaultFactoryUpgradeable_Proxy.initialize(
      VoterUpgradeable_Proxy,
      DeployedContracts[AliasDeployedContracts.FeesVaultUpgradeable_Implementation],
      {
        toGaugeRate: 10000,
        recipients: [],
        rates: [],
      },
    ),
  );

  await logTx(PairAPIUpgradeable_Proxy, PairAPIUpgradeable_Proxy.initialize(VoterUpgradeable_Proxy));
  await logTx(VeNFTAPIUpgradeable_Proxy, VeNFTAPIUpgradeable_Proxy.initialize(VoterUpgradeable_Proxy));
  await logTx(VeNFTAPIUpgradeable_Proxy, VeNFTAPIUpgradeable_Proxy.setManagedNFTManager(ManagedNFTManagerUpgradeable_Proxy));
  await logTx(VeNFTAPIUpgradeable_Proxy, VeNFTAPIUpgradeable_Proxy.setPairAPI(PairAPIUpgradeable_Proxy));

  await logTx(RewardAPIUpgradeable_Proxy, RewardAPIUpgradeable_Proxy.initialize(VoterUpgradeable_Proxy));

  await logTx(
    PairFactoryUpgradeable_Proxy,
    PairFactoryUpgradeable_Proxy.initialize(
      DeployedContracts[AliasDeployedContracts.Pair_Implementation],
      FeesVaultFactoryUpgradeable_Proxy,
    ),
  );
  await logTx(
    PairFactoryUpgradeable_Proxy,
    PairFactoryUpgradeable_Proxy.grantRole(await PairFactoryUpgradeable_Proxy.PAIRS_CREATOR_ROLE(), deployer),
  );

  await logTx(
    GetInformationAggregatorUpgradeable_Proxy,
    GetInformationAggregatorUpgradeable_Proxy.updateAddress(
      [
        GetInformationAddressKey.MANAGED_NFT_MANAGER,
        GetInformationAddressKey.PAIR_FACTORY,
        GetInformationAddressKey.VOTER,
        GetInformationAddressKey.VOTING_ESCROW,
      ],
      [
        DeployedContracts[AliasDeployedContracts.ManagedNFTManagerUpgradeable_Proxy],
        DeployedContracts[AliasDeployedContracts.PairFactoryUpgradeable_Proxy],
        DeployedContracts[AliasDeployedContracts.VoterUpgradeable_Proxy],
        DeployedContracts[AliasDeployedContracts.VotingEscrowUpgradeable_Proxy],
      ],
    ),
  );

  await logTx(VeNestDistributorUpgradeable_Proxy, VeNestDistributorUpgradeable_Proxy.initialize(Nest, VotingEscrowUpgradeable_Proxy));

  await logTx(VeNestDistributorUpgradeable_Proxy, VeNestDistributorUpgradeable_Proxy.grantRole(ethers.id('DISTRIBUTOR_ROLE'), deployer));

  await logTx(VeNestDistributorUpgradeable_Proxy, VeNestDistributorUpgradeable_Proxy.grantRole(ethers.id('WITHDRAWER_ROLE'), deployer));

  await logTx(
    VeNestSplitMerklAirdropUpgradeable_Proxy,
    VeNestSplitMerklAirdropUpgradeable_Proxy.initialize(Nest, VotingEscrowUpgradeable_Proxy, 0),
  );

  await logTx(
    VeNestSplitMerklAirdropUpgradeable_Proxy,
    VeNestSplitMerklAirdropUpgradeable_Proxy.setIsAllowedClaimOperator(VoterUpgradeable_Proxy, true),
  );

  await logTx(
    RouterV2PathProviderUpgradeable_Proxy,
    RouterV2PathProviderUpgradeable_Proxy.initialize(PairFactoryUpgradeable_Proxy, DeployedContracts[AliasDeployedContracts.RouterV2]),
  );

  await logTx(
    CompoundVeNESTManagedNFTStrategyFactoryUpgradeable_Proxy,
    CompoundVeNESTManagedNFTStrategyFactoryUpgradeable_Proxy.initialize(
      DeployedContracts[AliasDeployedContracts.CompoundVeNESTManagedNFTStrategyUpgradeable_Implementation],
      DeployedContracts[AliasDeployedContracts.SingelTokenVirtualRewarderUpgradeable_Implementation],
      ManagedNFTManagerUpgradeable_Proxy,
      RouterV2PathProviderUpgradeable_Proxy,
    ),
  );

  await logTx(GaugeRewader_Proxy, GaugeRewader_Proxy.initialize(Nest, VoterUpgradeable_Proxy, MinterUpgradeable_Proxy));

  await logTx(GaugeRewader_Proxy, GaugeRewader_Proxy.setSigner('0x41676a3Ad52294fceF2e875e3EaB92884dbB0A7e'));

  await logTx(GaugeRewader_Proxy, GaugeRewader_Proxy.grantRole(ethers.id('REWARDER_ROLE'), deployer));

  await logTx(GaugeRewader_Proxy, GaugeRewader_Proxy.grantRole(ethers.id('CLAMER_FOR_ROLE'), deployer));

  await logTx(
    CompoundEmissionExtensionUpgradeable_Proxy,
    CompoundEmissionExtensionUpgradeable_Proxy.initialize(VoterUpgradeable_Proxy, Nest, VotingEscrowUpgradeable_Proxy),
  );

  await logTx(
    FeesVaultFactoryUpgradeable_Proxy,
    FeesVaultFactoryUpgradeable_Proxy.grantRole(
      await FeesVaultFactoryUpgradeable_Proxy.WHITELISTED_CREATOR_ROLE(),
      PairFactoryUpgradeable_Proxy,
    ),
  );
  // await logTx(
  //   FeesVaultFactoryUpgradeable_Proxy,
  //   FeesVaultFactoryUpgradeable_Proxy.grantRole(
  //     await FeesVaultFactoryUpgradeable_Proxy.WHITELISTED_CREATOR_ROLE(),
  //     '0x9f72fdf5678289661de009edcefa1d255940aa7b',
  //   ),
  // );

  await logTx(
    FeesVaultFactoryUpgradeable_Proxy,
    FeesVaultFactoryUpgradeable_Proxy.grantRole(await FeesVaultFactoryUpgradeable_Proxy.FEES_VAULT_ADMINISTRATOR_ROLE(), deployer),
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
