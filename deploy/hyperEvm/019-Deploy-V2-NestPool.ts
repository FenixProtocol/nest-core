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
  await logTx(PairFactoryUpgradeable_Proxy, PairFactoryUpgradeable_Proxy.createPair(NEST, WHYPE, false));


  let pair = await PairFactoryUpgradeable_Proxy.getPair(WHYPE, NEST, false);

  const Voter = await ethers.getContractAt(
    InstanceName.VoterUpgradeable,
    DeployedContracts[AliasDeployedContracts.VoterUpgradeable_Proxy]
  )

  await logTx(Voter, Voter.createV2Gauge(pair));

  let VolatileDynamicFeeOnePool_Implementation = await deploy({
      name: InstanceName.VolatileDynamicFeeOnePool,
      deployer: deployer,
      constructorArguments: [],
      saveAlias: AliasDeployedContracts.VolatileDynamicFeeOnePool_Implementation,
      verify: true,
  });

  let proxy = await deployProxy({
        logic: (await VolatileDynamicFeeOnePool_Implementation.getAddress()),
        deployer: deployer,
        admin: ProxyAdmin,
        saveAlias: AliasDeployedContracts.VolatileDynamicFeeOnePool_Proxy,
        verify: true,
  });


  let VolatileDynamicFeeOnePool_Proxy = await ethers.getContractAt(InstanceName.VolatileDynamicFeeOnePool, proxy)
  await logTx(VolatileDynamicFeeOnePool_Proxy, VolatileDynamicFeeOnePool_Proxy.initialize(
    pair,
    1763654400,
    5000,
    150,
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
