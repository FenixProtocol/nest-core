import { ethers } from 'hardhat';
import { GaugeType } from '../../utils/Constants';
import { AliasDeployedContracts, deploy, deployProxy, getDeployedContractsAddressList, getProxyAdminAddress } from '../../utils/Deploy';
import { InstanceName } from '../../utils/Names';
import { deployERC20Mock } from '../../scripts/utils';

async function main() {
  const [deployer] = await ethers.getSigners();

  let DeployedContracts = await getDeployedContractsAddressList();
  const ProxyAdmin = await getProxyAdminAddress();

  let implementation = await deploy({
      name: InstanceName.VolatileDynamicFeeOnePool,
      deployer: deployer,
      constructorArguments: [],
      saveAlias: "VolatileDynamicFeeOnePool_Implementation",
      verify: true,
  });

  let contract = await deployProxy({
      logic: (await implementation.getAddress()),
      deployer: deployer,
      admin: ProxyAdmin,
      saveAlias: "VolatileDynamicFeeOnePool_Proxy",
      verify: false,
  });

  let DFM = await deploy({
        name: InstanceName.ERC20Mock,
        deployer: deployer,
        constructorArguments: ['Fake_DFM', 'DFM', 6],
        saveAlias: "ERC20Mock_DFM",
        verify: false,
      });

  let PairFactory = await ethers.getContractAt("PairFactoryUpgradeable", DeployedContracts[AliasDeployedContracts.PairFactoryUpgradeable_Proxy]);

  await PairFactory.createPair("0x7C5a2D63a06A0886ce414DFe7c43cb419e0B3B2a", DFM, false);

  function t(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  console.log(`Timeout for 10s before verify proccess...`);
  await t(10000);

  let pair = await PairFactory.getPair("0x7C5a2D63a06A0886ce414DFe7c43cb419e0B3B2a", DFM, false)

  await PairFactory.setCustomVolatileDynamicFeeModule(pair, contract);
  
  console.log(`Timeout for 10s before verify proccess...`);
  await t(10000);

  let Instance = await ethers.getContractAt("VolatileDynamicFeeOnePool", contract);
  await Instance.initialize(pair, 1761040244, 5000, 18, 60, 100);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
