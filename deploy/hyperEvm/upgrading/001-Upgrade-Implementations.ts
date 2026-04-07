import { ethers } from 'hardhat';
import { GaugeType } from '../../../utils/Constants';
import { AliasDeployedContracts, deploy, getDeployedContractsAddressList, getProxyAdminAddress, logTx } from '../../../utils/Deploy';
import { InstanceName } from '../../../utils/Names';
const PREVIOUS_EPOCH = 0; // TODO: set valid value, e.g 1773273600n;
const PREVIOUS_INDEX = 0; // TODO: set valid value, e.g 359391232473502260n;
const WEEK = 604800n;
async function main() {
  const [deployer] = await ethers.getSigners();

  const DeployedContracts = await getDeployedContractsAddressList();
  const ProxyAdmin = await getProxyAdminAddress();
  const ProxyAdmin_Typed = await ethers.getContractAt(InstanceName.ProxyAdmin, ProxyAdmin);

  if (PREVIOUS_EPOCH == 0 || PREVIOUS_INDEX == 0) {
    throw new Error('Previous epoch and index are not set');
  }

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

  // ──────────────────────────────────────────────────────────
  // 7. RouterV2 — deploy only
  // ──────────────────────────────────────────────────────────
  await deploy({
    name: InstanceName.RouterV2,
    deployer,
    constructorArguments: [],
    saveAlias: AliasDeployedContracts.RouterV2,
    verify: true,
  });

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

  const gaugeV3Impl = await deploy({
    name: InstanceName.GaugeUpgradeable,
    deployer,
    constructorArguments: [GaugeType.V3PairsGauge],
    saveAlias: AliasDeployedContracts.GaugeUpgradeable_V3Pools_Implementation,
    verify: true,
  });

  const gaugeFactoryV2 = await ethers.getContractAt(
    InstanceName.GaugeFactoryUpgradeable,
    DeployedContracts[AliasDeployedContracts.GaugeFactory_V2Pools_Proxy],
  );
  await logTx(gaugeFactoryV2, gaugeFactoryV2.changeImplementation(await gaugeV2Impl.getAddress()));

  const gaugeFactoryV3 = await ethers.getContractAt(
    InstanceName.GaugeFactoryUpgradeable,
    DeployedContracts[AliasDeployedContracts.GaugeFactory_V3Pools_Proxy],
  );
  await logTx(gaugeFactoryV3, gaugeFactoryV3.changeImplementation(await gaugeV3Impl.getAddress()));

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
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
