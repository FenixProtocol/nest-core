import { ethers } from 'hardhat';
import { GaugeType } from '../../utils/Constants';
import { AliasDeployedContracts, deploy, deployProxy, getDeployedContractsAddressList, getProxyAdminAddress } from '../../utils/Deploy';
import { InstanceName } from '../../utils/Names';
import { deployERC20Mock } from '../../scripts/utils';

async function main() {
  const [deployer] = await ethers.getSigners();

  let DeployedContracts = await getDeployedContractsAddressList();
  const ProxyAdmin = await getProxyAdminAddress();

  let Nest = await ethers.getContractAt("ERC20Mock", "0x7C5a2D63a06A0886ce414DFe7c43cb419e0B3B2a")

  //await Nest.transfer("0xB38685767B9Fa7F9E8d7b5A6d5A2b4e1e8117599", ethers.parseEther('40'));

  let strategy = await ethers.getContractAt("CompoundVeNESTManagedNFTStrategyUpgradeable", "0xb38685767b9fa7f9e8d7b5a6d5a2b4e1e8117599")

  //await strategy.compound();

  ///await Nest.transfer("0xb38685767b9fa7f9e8d7b5a6d5a2b4e1e8117599", ethers.parseEther('12.5'));

  await strategy.compound();

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
