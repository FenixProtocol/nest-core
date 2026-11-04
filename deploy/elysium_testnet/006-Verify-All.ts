import { ethers } from 'hardhat';
import { AliasDeployedContracts, getDeployedContractsAddressList } from '../../utils/Deploy';
import { InstanceName } from '../../utils/Names';
import { verify } from '../../utils/Verify';
import { DISTRIBUTION_PRECISION, getDeploymentContext, requireDeploymentAddress } from './_shared';

function isAlreadyVerifiedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.toLowerCase().includes('already verified');
}

async function main() {
  const { deployer, wrappedNative } = await getDeploymentContext();
  const deployments = await getDeployedContractsAddressList();

  const pairImplementation = requireDeploymentAddress(deployments, AliasDeployedContracts.Pair_Implementation);
  const feesVaultImplementation = requireDeploymentAddress(deployments, AliasDeployedContracts.FeesVaultUpgradeable_Implementation);
  const feesVaultFactoryImplementation = requireDeploymentAddress(
    deployments,
    AliasDeployedContracts.FeesVaultFactoryUpgradeable_Implementation,
  );
  const pairFactoryImplementation = requireDeploymentAddress(deployments, AliasDeployedContracts.PairFactoryUpgradeable_Implementation);
  const proxyAdmin = requireDeploymentAddress(deployments, AliasDeployedContracts.ProxyAdmin);
  const feesVaultFactoryProxy = requireDeploymentAddress(deployments, AliasDeployedContracts.FeesVaultFactoryUpgradeable_Proxy);
  const pairFactoryProxy = requireDeploymentAddress(deployments, AliasDeployedContracts.PairFactoryUpgradeable_Proxy);
  const router = requireDeploymentAddress(deployments, AliasDeployedContracts.RouterV2);
  const partialRouter = requireDeploymentAddress(deployments, AliasDeployedContracts.UniswapV2PartialRouter);

  const feesVaultFactory = await ethers.getContractFactory(InstanceName.FeesVaultFactoryUpgradeable);
  const feesVaultFactoryInitData = feesVaultFactory.interface.encodeFunctionData('initialize', [
    deployer.address,
    feesVaultImplementation,
    {
      toGaugeRate: 0,
      recipients: [deployer.address],
      rates: [DISTRIBUTION_PRECISION],
    },
  ]);

  const pairFactory = await ethers.getContractFactory(InstanceName.PairFactoryUpgradeable);
  const pairFactoryInitData = pairFactory.interface.encodeFunctionData('initialize', [pairImplementation, feesVaultFactoryProxy]);

  const targets: Array<{ alias: string; address: string; constructorArguments: unknown[] }> = [
    { alias: AliasDeployedContracts.Pair_Implementation, address: pairImplementation, constructorArguments: [] },
    {
      alias: AliasDeployedContracts.FeesVaultUpgradeable_Implementation,
      address: feesVaultImplementation,
      constructorArguments: [],
    },
    {
      alias: AliasDeployedContracts.FeesVaultFactoryUpgradeable_Implementation,
      address: feesVaultFactoryImplementation,
      constructorArguments: [],
    },
    {
      alias: AliasDeployedContracts.PairFactoryUpgradeable_Implementation,
      address: pairFactoryImplementation,
      constructorArguments: [],
    },
    { alias: AliasDeployedContracts.ProxyAdmin, address: proxyAdmin, constructorArguments: [] },
    {
      alias: AliasDeployedContracts.FeesVaultFactoryUpgradeable_Proxy,
      address: feesVaultFactoryProxy,
      constructorArguments: [feesVaultFactoryImplementation, proxyAdmin, feesVaultFactoryInitData],
    },
    {
      alias: AliasDeployedContracts.PairFactoryUpgradeable_Proxy,
      address: pairFactoryProxy,
      constructorArguments: [pairFactoryImplementation, proxyAdmin, pairFactoryInitData],
    },
    {
      alias: AliasDeployedContracts.RouterV2,
      address: router,
      constructorArguments: [pairFactoryProxy, wrappedNative],
    },
    {
      alias: AliasDeployedContracts.UniswapV2PartialRouter,
      address: partialRouter,
      constructorArguments: [pairFactoryProxy, wrappedNative],
    },
  ];

  const failures: string[] = [];
  for (const target of targets) {
    try {
      await verify(target.address, target.constructorArguments, true, 1000);
      console.log(`${target.alias} verified successfully.`);
    } catch (error) {
      if (isAlreadyVerifiedError(error)) {
        console.log(`${target.alias} is already verified.`);
      } else {
        console.error(`Failed to verify ${target.alias}:`, error);
        failures.push(target.alias);
      }
    }
  }

  if (failures.length > 0) {
    throw new Error(`Verification failed for: ${failures.join(', ')}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
