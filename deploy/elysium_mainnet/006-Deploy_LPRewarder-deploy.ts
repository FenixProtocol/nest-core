import { ethers } from 'hardhat';
import { AliasDeployedContracts, deploy, deployProxy, getProxyAdminAddress } from '../../utils/Deploy';
import { InstanceName } from '../../utils/Names';
import { getDeploymentContext } from './_shared';

async function main() {
  const { deployer } = await getDeploymentContext();
  const proxyAdmin = await getProxyAdminAddress();

  if (!proxyAdmin) {
    throw new Error('Missing ProxyAdmin in deployments/elysium_mainnet/deploys.json');
  }

  const implementation = await deploy({
    name: InstanceName.LPRewarder,
    deployer,
    constructorArguments: [],
    saveAlias: AliasDeployedContracts.LPRewarder_Implementation,
    verify: true,
  });

  const factory = await ethers.getContractFactory(InstanceName.LPRewarder);
  const initData = factory.interface.encodeFunctionData('initialize');
  const proxy = await deployProxy({
    deployer,
    logic: await implementation.getAddress(),
    admin: proxyAdmin,
    data: initData,
    saveAlias: AliasDeployedContracts.LPRewarder_Proxy,
    verify: true,
  });

  const rewarder = factory.attach(await proxy.getAddress());
  const adminRole = await rewarder.DEFAULT_ADMIN_ROLE();
  if (!(await rewarder.hasRole(adminRole, deployer.address))) {
    throw new Error('LPRewarder proxy was not initialized with the deployer as admin');
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
