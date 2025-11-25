import { ethers } from 'hardhat';
import { AliasDeployedContracts, getDeployedContractsAddressList, logTx } from '../../utils/Deploy';
import { InstanceName } from '../../utils/Names';

async function main() {
  const DeployedContracts = await getDeployedContractsAddressList();

  let TARGET_OWNER = "0x8CE4d7F93f8A55E6d120F302C0BcCE502B640827";

  const MinterUpgradeable_Proxy = await ethers.getContractAt(
    InstanceName.MinterUpgradeable,
    DeployedContracts[AliasDeployedContracts.MinterUpgradeable_Proxy]
  )
  await logTx(MinterUpgradeable_Proxy, MinterUpgradeable_Proxy.transferOwnership(TARGET_OWNER));

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
