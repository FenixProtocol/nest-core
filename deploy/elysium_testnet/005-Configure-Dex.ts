import { ethers } from 'hardhat';
import { AliasDeployedContracts, getDeployedContractsAddressList, logTx } from '../../utils/Deploy';
import { InstanceName } from '../../utils/Names';
import {
  assertAddressEquals,
  DISTRIBUTION_PRECISION,
  getDeploymentContext,
  PROTOCOL_FEE_SHARE,
  requireDeploymentAddress,
  STABLE_SWAP_FEE,
  VOLATILE_SWAP_FEE,
} from './_shared';

async function main() {
  const { deployer, wrappedNative } = await getDeploymentContext();
  const deployments = await getDeployedContractsAddressList();

  const pairImplementation = requireDeploymentAddress(deployments, AliasDeployedContracts.Pair_Implementation);
  const feesVaultImplementation = requireDeploymentAddress(deployments, AliasDeployedContracts.FeesVaultUpgradeable_Implementation);
  const pairFactoryImplementation = requireDeploymentAddress(deployments, AliasDeployedContracts.PairFactoryUpgradeable_Implementation);
  const feesVaultFactoryImplementation = requireDeploymentAddress(
    deployments,
    AliasDeployedContracts.FeesVaultFactoryUpgradeable_Implementation,
  );
  const proxyAdminAddress = requireDeploymentAddress(deployments, AliasDeployedContracts.ProxyAdmin);
  const pairFactoryProxyAddress = requireDeploymentAddress(deployments, AliasDeployedContracts.PairFactoryUpgradeable_Proxy);
  const feesVaultFactoryProxyAddress = requireDeploymentAddress(deployments, AliasDeployedContracts.FeesVaultFactoryUpgradeable_Proxy);
  const routerAddress = requireDeploymentAddress(deployments, AliasDeployedContracts.RouterV2);
  const partialRouterAddress = requireDeploymentAddress(deployments, AliasDeployedContracts.UniswapV2PartialRouter);
  const storedWrappedNative = requireDeploymentAddress(deployments, AliasDeployedContracts.WrappedNative);

  const pairFactory = await ethers.getContractAt(InstanceName.PairFactoryUpgradeable, pairFactoryProxyAddress);
  const feesVaultFactory = await ethers.getContractAt(InstanceName.FeesVaultFactoryUpgradeable, feesVaultFactoryProxyAddress);
  const proxyAdmin = await ethers.getContractAt(InstanceName.ProxyAdmin, proxyAdminAddress);

  await logTx(feesVaultFactory, feesVaultFactory.grantRole(await feesVaultFactory.WHITELISTED_CREATOR_ROLE(), pairFactoryProxyAddress));
  await logTx(feesVaultFactory, feesVaultFactory.grantRole(await feesVaultFactory.FEES_VAULT_ADMINISTRATOR_ROLE(), deployer.address));
  await logTx(feesVaultFactory, feesVaultFactory.grantRole(await feesVaultFactory.CLAIM_FEES_CALLER_ROLE(), deployer.address));

  await logTx(pairFactory, pairFactory.grantRole(await pairFactory.PAIRS_CREATOR_ROLE(), deployer.address));
  await logTx(pairFactory, pairFactory.grantRole(await pairFactory.PAIRS_ADMINISTRATOR_ROLE(), deployer.address));
  await logTx(pairFactory, pairFactory.grantRole(await pairFactory.FEES_MANAGER_ROLE(), deployer.address));
  await logTx(pairFactory, pairFactory.setIsPublicPoolCreationMode(false));
  await logTx(pairFactory, pairFactory.setFee(false, VOLATILE_SWAP_FEE));
  await logTx(pairFactory, pairFactory.setFee(true, STABLE_SWAP_FEE));
  await logTx(pairFactory, pairFactory.setProtocolFee(PROTOCOL_FEE_SHARE));

  assertAddressEquals('PairFactory.implementation', await pairFactory.implementation(), pairImplementation);
  assertAddressEquals('PairFactory.communityVaultFactory', await pairFactory.communityVaultFactory(), feesVaultFactoryProxyAddress);
  assertAddressEquals(
    'FeesVaultFactory.feesVaultImplementation',
    await feesVaultFactory.feesVaultImplementation(),
    feesVaultImplementation,
  );
  assertAddressEquals('FeesVaultFactory.voter', await feesVaultFactory.voter(), deployer.address);
  assertAddressEquals('WrappedNative registry value', storedWrappedNative, wrappedNative);
  assertAddressEquals('ProxyAdmin.owner', await proxyAdmin.owner(), deployer.address);
  assertAddressEquals('FeesVaultFactory proxy admin', await proxyAdmin.getProxyAdmin(feesVaultFactoryProxyAddress), proxyAdminAddress);
  assertAddressEquals(
    'FeesVaultFactory proxy implementation',
    await proxyAdmin.getProxyImplementation(feesVaultFactoryProxyAddress),
    feesVaultFactoryImplementation,
  );
  assertAddressEquals('PairFactory proxy admin', await proxyAdmin.getProxyAdmin(pairFactoryProxyAddress), proxyAdminAddress);
  assertAddressEquals(
    'PairFactory proxy implementation',
    await proxyAdmin.getProxyImplementation(pairFactoryProxyAddress),
    pairFactoryImplementation,
  );

  const requiredPairRoles = [
    await pairFactory.DEFAULT_ADMIN_ROLE(),
    await pairFactory.PAIRS_CREATOR_ROLE(),
    await pairFactory.PAIRS_ADMINISTRATOR_ROLE(),
    await pairFactory.FEES_MANAGER_ROLE(),
  ];
  for (const role of requiredPairRoles) {
    if (!(await pairFactory.hasRole(role, deployer.address))) {
      throw new Error(`PairFactory role ${role} is not granted to ${deployer.address}`);
    }
  }

  const requiredFeesVaultRoles = [
    await feesVaultFactory.DEFAULT_ADMIN_ROLE(),
    await feesVaultFactory.FEES_VAULT_ADMINISTRATOR_ROLE(),
    await feesVaultFactory.CLAIM_FEES_CALLER_ROLE(),
  ];
  for (const role of requiredFeesVaultRoles) {
    if (!(await feesVaultFactory.hasRole(role, deployer.address))) {
      throw new Error(`FeesVaultFactory role ${role} is not granted to ${deployer.address}`);
    }
  }
  if (!(await feesVaultFactory.hasRole(await feesVaultFactory.WHITELISTED_CREATOR_ROLE(), pairFactoryProxyAddress))) {
    throw new Error('PairFactory proxy is not a whitelisted fee-vault creator');
  }

  if (await pairFactory.isPublicPoolCreationMode()) {
    throw new Error('Public pair creation must remain disabled');
  }
  if ((await pairFactory.volatileFee()) !== VOLATILE_SWAP_FEE) {
    throw new Error('Unexpected volatile swap fee');
  }
  if ((await pairFactory.stableFee()) !== STABLE_SWAP_FEE) {
    throw new Error('Unexpected stable swap fee');
  }
  if ((await pairFactory.protocolFee()) !== PROTOCOL_FEE_SHARE) {
    throw new Error('Unexpected protocol fee share');
  }

  const distribution = await feesVaultFactory.defaultDistributionConfig();
  if (
    distribution.toGaugeRate !== 0n ||
    distribution.recipients.length !== 1 ||
    distribution.rates.length !== 1 ||
    distribution.recipients[0].toLowerCase() !== deployer.address.toLowerCase() ||
    distribution.rates[0] !== DISTRIBUTION_PRECISION
  ) {
    throw new Error('Unexpected default fee-vault distribution configuration');
  }

  const router = await ethers.getContractAt(InstanceName.RouterV2, routerAddress);
  const partialRouter = await ethers.getContractAt(InstanceName.UniswapV2PartialRouter, partialRouterAddress);
  assertAddressEquals('RouterV2.factory', await router.factory(), pairFactoryProxyAddress);
  assertAddressEquals('RouterV2.wETH', await router.wETH(), wrappedNative);
  assertAddressEquals('UniswapV2PartialRouter.factory', await partialRouter.factory(), pairFactoryProxyAddress);
  assertAddressEquals('UniswapV2PartialRouter.WETH', await partialRouter.WETH(), wrappedNative);

  const expectedAliases = new Set([
    AliasDeployedContracts.Pair_Implementation,
    AliasDeployedContracts.FeesVaultUpgradeable_Implementation,
    AliasDeployedContracts.FeesVaultFactoryUpgradeable_Implementation,
    AliasDeployedContracts.PairFactoryUpgradeable_Implementation,
    AliasDeployedContracts.ProxyAdmin,
    AliasDeployedContracts.FeesVaultFactoryUpgradeable_Proxy,
    AliasDeployedContracts.PairFactoryUpgradeable_Proxy,
    AliasDeployedContracts.WrappedNative,
    AliasDeployedContracts.RouterV2,
    AliasDeployedContracts.UniswapV2PartialRouter,
  ]);
  const unexpectedAliases = Object.keys(deployments).filter((alias) => !expectedAliases.has(alias as AliasDeployedContracts));
  if (unexpectedAliases.length > 0) {
    throw new Error(`Unexpected contracts in Elysium deployment registry: ${unexpectedAliases.join(', ')}`);
  }

  console.log('Elysium V2 DEX configuration validated successfully.');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
