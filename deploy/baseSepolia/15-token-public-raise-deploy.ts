import { ethers } from 'hardhat';
import { GaugeType } from '../../utils/Constants';
import { AliasDeployedContracts, deploy, deployProxy, getDeployedContractsAddressList, getProxyAdminAddress } from '../../utils/Deploy';
import { InstanceName } from '../../utils/Names';

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

  await instance.initialize(1761050261, 1761309461, ethers.parseEther('0.000001'), ethers.parseEther('0.01'), ethers.parseEther('0.1'), ethers.parseEther('2.75'), deployer)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
