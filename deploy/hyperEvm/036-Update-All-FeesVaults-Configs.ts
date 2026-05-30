import { ethers } from 'hardhat';
import { AliasDeployedContracts, getDeployedContractsAddressList, logTx } from '../../utils/Deploy';
import { InstanceName } from '../../utils/Names';

const TARGET_TO_GAUGE_RATE = 10000n;
const TARGET_CONFIG = {
  toGaugeRate: TARGET_TO_GAUGE_RATE,
  recipients: [],
  rates: [],
};

type DistributionConfig = {
  toGaugeRate: bigint;
  recipients: string[];
  rates: bigint[];
};

function formatConfig(config: DistributionConfig) {
  return {
    toGaugeRate: config.toGaugeRate.toString(),
    recipients: config.recipients,
    rates: config.rates.map((rate) => rate.toString()),
  };
}

function isTargetConfig(config: DistributionConfig) {
  return config.toGaugeRate === TARGET_TO_GAUGE_RATE && config.recipients.length === 0 && config.rates.length === 0;
}

async function getDistributionConfig(feesVaultFactory: any, feesVault: string): Promise<DistributionConfig> {
  const [toGaugeRate, recipients, rates] = await feesVaultFactory.getDistributionConfig(feesVault);
  return { toGaugeRate, recipients, rates };
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const deployedContracts = await getDeployedContractsAddressList();

  const VoterUpgradeable = await ethers.getContractAt(
    InstanceName.VoterUpgradeable,
    deployedContracts[AliasDeployedContracts.VoterUpgradeable_Proxy],
    deployer,
  );
  const FeesVaultFactoryUpgradeable = await ethers.getContractAt(
    InstanceName.FeesVaultFactoryUpgradeable,
    deployedContracts[AliasDeployedContracts.FeesVaultFactoryUpgradeable_Proxy],
    deployer,
  );

  console.log(`Deployer: ${deployer.address}`);
  console.log(`VoterUpgradeable: ${await VoterUpgradeable.getAddress()}`);
  console.log(`FeesVaultFactoryUpgradeable: ${await FeesVaultFactoryUpgradeable.getAddress()}`);

  const [poolsCount] = await VoterUpgradeable.poolsCounts();
  console.log(`Pools count: ${poolsCount.toString()}`);

  const feesVaultsByPool: { pool: string; feesVault: string }[] = [];
  const processedFeesVaults = new Set<string>();

  for (let i = 0n; i < poolsCount; i++) {
    const pool = await VoterUpgradeable.pools(i);
    const poolContract = await ethers.getContractAt('IPairIntegrationInfo', pool, deployer);
    const feesVault = await poolContract.communityVault();

    if (feesVault === ethers.ZeroAddress) {
      console.log(`Pool ${pool} has zero communityVault, skipped`);
      continue;
    }

    const normalizedFeesVault = feesVault.toLowerCase();
    if (processedFeesVaults.has(normalizedFeesVault)) {
      console.log(`Pool ${pool} uses already processed feesVault ${feesVault}, skipped`);
      continue;
    }

    processedFeesVaults.add(normalizedFeesVault);
    feesVaultsByPool.push({ pool, feesVault });
  }

  console.log(`FeesVaults found: ${feesVaultsByPool.length}`);

  const feesVaultsForCreatorReset: string[] = [];

  for (const { pool, feesVault } of feesVaultsByPool) {
    const config = await getDistributionConfig(FeesVaultFactoryUpgradeable, feesVault);

    if (isTargetConfig(config)) {
      console.log(`Pool ${pool} FeesVault ${feesVault} already has target config`);
      continue;
    }

    console.log(`Pool ${pool} FeesVault ${feesVault} config: ${JSON.stringify(formatConfig(config))}`);

    const isCustomConfig = await FeesVaultFactoryUpgradeable.isCustomConfig(feesVault);
    if (isCustomConfig) {
      await logTx(
        FeesVaultFactoryUpgradeable,
        FeesVaultFactoryUpgradeable.setCustomDistributionConfig(feesVault, TARGET_CONFIG),
      );
      continue;
    }

    const creator = await FeesVaultFactoryUpgradeable.getFeesVaultCreator(feesVault);
    if (creator !== ethers.ZeroAddress) {
      console.log(`Queue creator reset for FeesVault ${feesVault}. Current creator: ${creator}`);
      feesVaultsForCreatorReset.push(feesVault);
    }
  }

  if (feesVaultsForCreatorReset.length > 0) {
    await logTx(
      FeesVaultFactoryUpgradeable,
      FeesVaultFactoryUpgradeable.changeCreatorForFeesVaults(ethers.ZeroAddress, feesVaultsForCreatorReset),
    );
  }

  for (const { feesVault } of feesVaultsByPool) {
    const config = await getDistributionConfig(FeesVaultFactoryUpgradeable, feesVault);
    if (isTargetConfig(config)) {
      continue;
    }

    console.log(`FeesVault ${feesVault} still has non-target config after creator reset: ${JSON.stringify(formatConfig(config))}`);
    await logTx(
      FeesVaultFactoryUpgradeable,
      FeesVaultFactoryUpgradeable.setCustomDistributionConfig(feesVault, TARGET_CONFIG),
    );
  }

  const failed: { pool: string; feesVault: string; config: ReturnType<typeof formatConfig> }[] = [];
  for (const { pool, feesVault } of feesVaultsByPool) {
    const config = await getDistributionConfig(FeesVaultFactoryUpgradeable, feesVault);
    if (!isTargetConfig(config)) {
      failed.push({ pool, feesVault, config: formatConfig(config) });
    }
  }

  if (failed.length > 0) {
    console.log(JSON.stringify(failed, null, 2));
    throw new Error(`Failed to update ${failed.length} FeesVault configs`);
  }

  console.log(`All ${feesVaultsByPool.length} FeesVault configs now have toGaugeRate ${TARGET_TO_GAUGE_RATE.toString()}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
