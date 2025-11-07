import {
  AliasDeployedContracts,
  deploy,
  deployProxy,
  getDeployedContractsAddressList,
  getProxyAdminAddress,
  logTx,
} from '../../utils/Deploy';
import { ethers } from 'hardhat';
import { InstanceName } from '../../utils/Names';
import { GetInformationAddressKey } from '../../utils/Constants';

async function main() {
  const [deployer] = await ethers.getSigners();

  const DeployedContracts = await getDeployedContractsAddressList();
  const ProxyAdmin = await getProxyAdminAddress();

  let impl = await deploy({
      name: InstanceName.TokenPublicRaiseUpgradeable,
      deployer: deployer,
      constructorArguments: [],
      saveAlias: AliasDeployedContracts.TokenPublicRaiseUpgradeable_Implementation,
      verify: true,
  });

  let addr = await deployProxy({
          logic: (await impl.getAddress()),
          deployer: deployer,
          admin: ProxyAdmin,
          saveAlias: AliasDeployedContracts.TokenPublicRaiseUpgradeable_Proxy,
          verify: true,
  });


  let instance = await ethers.getContractAt(InstanceName.TokenPublicRaiseUpgradeable, addr)

  await logTx(instance, instance.initialize(
    1793484378,
    1793570778,
    ethers.parseEther('0.1'),
    ethers.parseEther('187.5'),
    ethers.parseEther('3750'),
    ethers.parseEther('2000'),
    deployer
  ));

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
