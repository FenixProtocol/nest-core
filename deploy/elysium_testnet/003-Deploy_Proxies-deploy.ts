import { ethers } from 'hardhat';
import { AliasDeployedContracts, deployProxy, getDeployedContractsAddressList } from '../../utils/Deploy';
import { InstanceName } from '../../utils/Names';
import { DISTRIBUTION_PRECISION, getDeploymentContext, requireDeploymentAddress } from './_shared';

async function main() {
  const { deployer } = await getDeploymentContext();
  const deployments = await getDeployedContractsAddressList();

  const proxyAdmin = requireDeploymentAddress(deployments, AliasDeployedContracts.ProxyAdmin);
  const pairImplementation = requireDeploymentAddress(deployments, AliasDeployedContracts.Pair_Implementation);
  const feesVaultImplementation = requireDeploymentAddress(deployments, AliasDeployedContracts.FeesVaultUpgradeable_Implementation);
  const feesVaultFactoryImplementation = requireDeploymentAddress(
    deployments,
    AliasDeployedContracts.FeesVaultFactoryUpgradeable_Implementation,
  );
  const pairFactoryImplementation = requireDeploymentAddress(deployments, AliasDeployedContracts.PairFactoryUpgradeable_Implementation);

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

  const feesVaultFactoryProxy = await deployProxy({
    deployer,
    logic: feesVaultFactoryImplementation,
    admin: proxyAdmin,
    data: feesVaultFactoryInitData,
    saveAlias: AliasDeployedContracts.FeesVaultFactoryUpgradeable_Proxy,
    verify: true,
  });

  const pairFactory = await ethers.getContractFactory(InstanceName.PairFactoryUpgradeable);
  const pairFactoryInitData = pairFactory.interface.encodeFunctionData('initialize', [
    pairImplementation,
    await feesVaultFactoryProxy.getAddress(),
  ]);

  await deployProxy({
    deployer,
    logic: pairFactoryImplementation,
    admin: proxyAdmin,
    data: pairFactoryInitData,
    saveAlias: AliasDeployedContracts.PairFactoryUpgradeable_Proxy,
    verify: true,
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
