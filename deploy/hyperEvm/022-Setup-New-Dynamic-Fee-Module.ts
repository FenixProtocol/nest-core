import { ethers } from 'hardhat';
import { AliasDeployedContracts, deploy, deployProxy, getDeployedContractsAddressList, getProxyAdminAddress, logTx } from '../../utils/Deploy';
import { InstanceName } from '../../utils/Names';

async function main() {
  const [deployer] = await ethers.getSigners();

  const DeployedContracts = await getDeployedContractsAddressList();
  const ProxyAdmin = await getProxyAdminAddress();

  const PairFactoryUpgradeable_Proxy = await ethers.getContractAt(
    InstanceName.PairFactoryUpgradeable,
    DeployedContracts[AliasDeployedContracts.PairFactoryUpgradeable_Proxy],
  );
  
  let NEST =  "0x07c57E32a3C29D5659bda1d3EFC2E7BF004E3035"
  let WHYPE = "0x5555555555555555555555555555555555555555"

  let pair = await PairFactoryUpgradeable_Proxy.getPair(WHYPE, NEST, false);

  let proxy = await deployProxy({
        logic: DeployedContracts[AliasDeployedContracts.VolatileDynamicFeeOnePool_Implementation],
        deployer: deployer,
        admin: ProxyAdmin,
        saveAlias: AliasDeployedContracts.VolatileDynamicFeeOnePool_Proxy,
        verify: false,
  });


  let VolatileDynamicFeeOnePool_Proxy = await ethers.getContractAt(InstanceName.VolatileDynamicFeeOnePool, proxy)
  await logTx(VolatileDynamicFeeOnePool_Proxy, VolatileDynamicFeeOnePool_Proxy.initialize(
    pair,
    1763654400,
    5000,
    200,
    60,
    100
   ))


  await logTx(PairFactoryUpgradeable_Proxy, PairFactoryUpgradeable_Proxy.setCustomVolatileDynamicFeeModule(pair, VolatileDynamicFeeOnePool_Proxy))
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
