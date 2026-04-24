import { ethers } from 'hardhat';
import { GaugeType } from '../../../utils/Constants';
import { AliasDeployedContracts, deploy, getDeployedContractsAddressList, getProxyAdminAddress, logTx } from '../../../utils/Deploy';
import { InstanceName } from '../../../utils/Names';
const PREVIOUS_EPOCH = 1775088000n; // TODO: set valid value, e.g 1773273600n;
const PREVIOUS_INDEX = 420741890673727469n; // TODO: set valid value, e.g 359391232473502260n;
const WEEK = 604800n;
async function main() {
  const [deployer] = await ethers.getSigners();

  const DeployedContracts = await getDeployedContractsAddressList();
  const ProxyAdmin = await getProxyAdminAddress();
  const ProxyAdmin_Typed = await ethers.getContractAt(InstanceName.ProxyAdmin, ProxyAdmin);
  // ──────────────────────────────────────────────────────────
  // 1. BribeVeNESTRewardToken — deploy + ProxyAdmin.upgrade
  // ──────────────────────────────────────────────────────────
  const bribeVeNESTRewardTokenImpl = await deploy({
    name: InstanceName.BribeVeNESTRewardToken,
    deployer,
    constructorArguments: [],
    saveAlias: AliasDeployedContracts.BribeVeNESTRewardToken_Implementation,
    verify: true,
  });
  await logTx(
    ProxyAdmin_Typed,
    ProxyAdmin_Typed.upgrade(
      DeployedContracts[AliasDeployedContracts.BribeVeNESTRewardToken_Proxy],
      await bribeVeNESTRewardTokenImpl.getAddress(),
    ),
  );

  console.log('\nBribeVeNESTRewardToken upgraded\n');

  // ──────────────────────────────────────────────────────────
  // 2. CustomBribeRewardRouter — deploy + ProxyAdmin.upgrade
  // ──────────────────────────────────────────────────────────
  const customBribeRewardRouterImpl = await deploy({
    name: InstanceName.CustomBribeRewardRouter,
    deployer,
    constructorArguments: [],
    saveAlias: AliasDeployedContracts.CustomBribeRewardRouter_Implementation,
    verify: true,
  });
  await logTx(
    ProxyAdmin_Typed,
    ProxyAdmin_Typed.upgrade(
      DeployedContracts[AliasDeployedContracts.CustomBribeRewardRouter_Proxy],
      await customBribeRewardRouterImpl.getAddress(),
    ),
  );

  console.log('\nCustomBribeRewardRouter upgraded\n');

  // ──────────────────────────────────────────────────────────
  // 3. CompoundEmissionExtensionUpgradeable — deploy + ProxyAdmin.upgrade
  // ──────────────────────────────────────────────────────────
  const compoundEmissionExtImpl = await deploy({
    name: InstanceName.CompoundEmissionExtensionUpgradeable,
    deployer,
    constructorArguments: [],
    saveAlias: AliasDeployedContracts.CompoundEmissionExtensionUpgradeable_Implementation,
    verify: true,
  });
  await logTx(
    ProxyAdmin_Typed,
    ProxyAdmin_Typed.upgrade(
      DeployedContracts[AliasDeployedContracts.CompoundEmissionExtensionUpgradeable_Proxy],
      await compoundEmissionExtImpl.getAddress(),
    ),
  );

  console.log('\nCompoundEmissionExtensionUpgradeable upgraded\n');

  // ──────────────────────────────────────────────────────────
  // 4. VotingEscrowUpgradeableV2 — deploy + ProxyAdmin.upgrade
  // ──────────────────────────────────────────────────────────
  const votingEscrowImpl = await deploy({
    name: InstanceName.VotingEscrowUpgradeable,
    deployer,
    constructorArguments: [],
    saveAlias: AliasDeployedContracts.VotingEscrowUpgradeable_Implementation,
    verify: true,
  });
  await logTx(
    ProxyAdmin_Typed,
    ProxyAdmin_Typed.upgrade(
      DeployedContracts[AliasDeployedContracts.VotingEscrowUpgradeable_Proxy],
      await votingEscrowImpl.getAddress(),
    ),
  );

  console.log('\nVotingEscrowUpgradeable upgraded\n');

  // ──────────────────────────────────────────────────────────
  // 5. VoterUpgradeableV2 — deploy + ProxyAdmin.upgradeAndCall(reinitialize)
  // ──────────────────────────────────────────────────────────
  const voterImpl = await deploy({
    name: InstanceName.VoterUpgradeable,
    deployer,
    constructorArguments: [],
    saveAlias: AliasDeployedContracts.VoterUpgradeable_Implementation,
    verify: true,
  });

  const voterInterface = (await ethers.getContractFactory(InstanceName.VoterUpgradeable)).interface;
  const voter = await ethers.getContractAt(InstanceName.VoterUpgradeable, DeployedContracts[AliasDeployedContracts.VoterUpgradeable_Proxy]);
  const latestIndex = await voter.index();
  const latestEpoch = await voter.epochTimestamp();
  if (latestEpoch - WEEK != PREVIOUS_EPOCH) { throw new Error('Previous epoch is not correct'); }
  if (latestIndex <= PREVIOUS_INDEX) { throw new Error('Previous index must be smaller than current index'); }
  // previous epoch, current epoch
  const epochs: bigint[] = [PREVIOUS_EPOCH, latestEpoch];
  const epochIndexes: bigint[] = [PREVIOUS_INDEX, latestIndex];
  const reinitializeCalldata = voterInterface.encodeFunctionData('reinitialize', [epochs, epochIndexes]);

  await logTx(
    ProxyAdmin_Typed,
    ProxyAdmin_Typed.upgradeAndCall(
      DeployedContracts[AliasDeployedContracts.VoterUpgradeable_Proxy],
      await voterImpl.getAddress(),
      reinitializeCalldata,
    ),
  );

  console.log('\nVoterUpgradeable upgraded\n');

  // ──────────────────────────────────────────────────────────
  // 6. Pair — deploy + PairFactory.upgradePairImplementation
  // ──────────────────────────────────────────────────────────
  const pairImpl = await deploy({
    name: InstanceName.Pair,
    deployer,
    constructorArguments: [],
    saveAlias: AliasDeployedContracts.Pair_Implementation,
    verify: true,
  });

  const pairFactory = await ethers.getContractAt(
    InstanceName.PairFactoryUpgradeable,
    DeployedContracts[AliasDeployedContracts.PairFactoryUpgradeable_Proxy],
  );
  await logTx(pairFactory, pairFactory.upgradePairImplementation(await pairImpl.getAddress()));

  console.log('\nPair upgraded\n');

  // ──────────────────────────────────────────────────────────
  // 7. RouterV2 — deploy only
  // ──────────────────────────────────────────────────────────
  const pairFactoryAddress = "0x889Fd0aDA8453C7619cD7f11E9029a1f0848Fdf5";
  const wETHAddress = "0x5555555555555555555555555555555555555555";
  await deploy({
    name: InstanceName.RouterV2,
    deployer,
    constructorArguments: [pairFactoryAddress, wETHAddress],
    saveAlias: AliasDeployedContracts.RouterV2,
    verify: true,
  });

  console.log('\nRouterV2 deployed\n');

  // ──────────────────────────────────────────────────────────
  // 8. GaugeUpgradeable — deploy V2 & V3 + GaugeFactory.changeImplementation (both)
  // ──────────────────────────────────────────────────────────
  const gaugeV2Impl = await deploy({
    name: InstanceName.GaugeUpgradeable,
    deployer,
    constructorArguments: [GaugeType.V2PairsGauge],
    saveAlias: AliasDeployedContracts.GaugeUpgradeable_V2Pools_Implementation,
    verify: true,
  });

  console.log('\nGaugeUpgradeable V2 deployed\n');

  const gaugeV3Impl = await deploy({
    name: InstanceName.GaugeUpgradeable,
    deployer,
    constructorArguments: [GaugeType.V3PairsGauge],
    saveAlias: AliasDeployedContracts.GaugeUpgradeable_V3Pools_Implementation,
    verify: true,
  });

  console.log('\nGaugeUpgradeable V3 deployed\n');

  const gaugeFactoryV2 = await ethers.getContractAt(
    InstanceName.GaugeFactoryUpgradeable,
    DeployedContracts[AliasDeployedContracts.GaugeFactory_V2Pools_Proxy],
  );
  await logTx(gaugeFactoryV2, gaugeFactoryV2.changeImplementation(await gaugeV2Impl.getAddress()));

  console.log('\nGauge V2 implementation updated\n');

  const gaugeFactoryV3 = await ethers.getContractAt(
    InstanceName.GaugeFactoryUpgradeable,
    DeployedContracts[AliasDeployedContracts.GaugeFactory_V3Pools_Proxy],
  );
  await logTx(gaugeFactoryV3, gaugeFactoryV3.changeImplementation(await gaugeV3Impl.getAddress()));

  console.log('\nGauge V3 implementation updated\n');

  // ──────────────────────────────────────────────────────────
  // 9. CompoundVeNESTManagedNFTStrategyUpgradeable — deploy + factory.changeStrategyImplementation
  // ──────────────────────────────────────────────────────────
  const strategyImpl = await deploy({
    name: InstanceName.CompoundVeNESTManagedNFTStrategyUpgradeable,
    deployer,
    constructorArguments: [],
    saveAlias: AliasDeployedContracts.CompoundVeNESTManagedNFTStrategyUpgradeable_Implementation,
    verify: true,
  });

  const strategyFactory = await ethers.getContractAt(
    InstanceName.CompoundVeNESTManagedNFTStrategyFactoryUpgradeable,
    DeployedContracts[AliasDeployedContracts.CompoundVeNESTManagedNFTStrategyFactoryUpgradeable_Proxy],
  );
  await logTx(strategyFactory, strategyFactory.changeStrategyImplementation(await strategyImpl.getAddress()));

  console.log('\nStrategy implementation updated\n');

  // ──────────────────────────────────────────────────────────
  // 10. SingelTokenVirtualRewarderUpgradeable — deploy + factory.changeVirtualRewarderImplementation
  // ──────────────────────────────────────────────────────────
  const virtualRewarderImpl = await deploy({
    name: InstanceName.SingelTokenVirtualRewarderUpgradeable,
    deployer,
    constructorArguments: [],
    saveAlias: AliasDeployedContracts.SingelTokenVirtualRewarderUpgradeable_Implementation,
    verify: true,
  });

  await logTx(strategyFactory, strategyFactory.changeVirtualRewarderImplementation(await virtualRewarderImpl.getAddress()));

  console.log('\nVirtualRewarder implementation updated\n');

  // ──────────────────────────────────────────────────────────
  // 11. BribeUpgradeable — deploy + BribeFactory.changeImplementation
  // ──────────────────────────────────────────────────────────
  const bribeImpl = await deploy({
    name: InstanceName.BribeUpgradeable,
    deployer,
    constructorArguments: [],
    saveAlias: AliasDeployedContracts.BribeUpgradeable_Implementation,
    verify: true,
  });

  const bribeFactory = await ethers.getContractAt(
    InstanceName.BribeFactoryUpgradeable,
    DeployedContracts[AliasDeployedContracts.BribeFactoryUpgradeable_Proxy],
  );
  await logTx(bribeFactory, bribeFactory.changeImplementation(await bribeImpl.getAddress()));

  console.log('\nBribe implementation updated\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
