import { ethers } from 'hardhat';
import { AliasDeployedContracts, deploy, deployProxy, getDeployedContractsAddressList, getProxyAdminAddress, logTx } from '../../utils/Deploy';
import { InstanceName } from '../../utils/Names';

async function main() {
  const DeployedContracts = await getDeployedContractsAddressList();

  const VeNestSplitMerklAidropUpgradeable_Proxy = await ethers.getContractAt(
    InstanceName.VeNestSplitMerklAidropUpgradeable,
    DeployedContracts[AliasDeployedContracts.VeNestSplitMerklAidropUpgradeable_Proxy],
  );
  
  await logTx(VeNestSplitMerklAidropUpgradeable_Proxy, VeNestSplitMerklAidropUpgradeable_Proxy.setMerklRoot("0xf596283557fa888f0c7ede54332fe3aacf4c98b78ae6ec08061f284de32f0f3f"));

  await logTx(VeNestSplitMerklAidropUpgradeable_Proxy, VeNestSplitMerklAidropUpgradeable_Proxy.pause());

  const Nest = await ethers.getContractAt(
    InstanceName.Nest,
    DeployedContracts[AliasDeployedContracts.Nest]
  );

  if(VeNestSplitMerklAidropUpgradeable_Proxy.target == "0xB97B9217B55F322F7105f34777Af9F63B3b720A6") {
    await logTx(Nest, Nest.transfer(VeNestSplitMerklAidropUpgradeable_Proxy, "50000000000000070256403976"))

  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
