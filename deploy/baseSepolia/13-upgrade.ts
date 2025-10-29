import { ethers } from 'hardhat';
import { GaugeType } from '../../utils/Constants';
import { AliasDeployedContracts, deploy, deployProxy, getDeployedContractsAddressList, getProxyAdminAddress } from '../../utils/Deploy';
import { InstanceName } from '../../utils/Names';
import { time } from '@nomicfoundation/hardhat-toolbox/network-helpers';

async function main() {
  const [deployer] = await ethers.getSigners();

  const DeployedContracts = await getDeployedContractsAddressList();
  const ProxyAdmin = await getProxyAdminAddress();

  let contractAddr = DeployedContracts["VolatileDynamicFeeOnePool_Proxy"]

  let Instance = await ethers.getContractAt("VolatileDynamicFeeOnePool", contractAddr);
  let PairFactory = await ethers.getContractAt("PairFactoryUpgradeable", DeployedContracts[AliasDeployedContracts.PairFactoryUpgradeable_Proxy]);

  await PairFactory.setCustomVolatileDynamicFeeModule("0x1Ff5A357f418bD3883321B94ba14A9F72e7044e1", Instance);
  
  await Instance.initialize("0x1Ff5A357f418bD3883321B94ba14A9F72e7044e1", 1760590858, 5000, 18, 60, 100);

  await 
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
