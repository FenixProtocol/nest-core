import { ethers } from 'hardhat';
import { AliasDeployedContracts, deploy, getDeployedContractsAddressList, getProxyAdminAddress, logTx } from '../../utils/Deploy';
import { InstanceName } from '../../utils/Names';

async function main() {
  const DeployedContracts = await getDeployedContractsAddressList();

  const VoterUpgradeable_Proxy = await ethers.getContractAt(
    InstanceName.VoterUpgradeable,
    DeployedContracts[AliasDeployedContracts.VoterUpgradeable_Proxy],
  );
  
  await logTx(VoterUpgradeable_Proxy, VoterUpgradeable_Proxy.createV3Gauge('0x20e6E73C91a29d21BdE672562a4B16649D66623E'));
  await logTx(VoterUpgradeable_Proxy, VoterUpgradeable_Proxy.createV3Gauge('0x998007a512531d9081e116F85605C40d41Abd4f1'));
  await logTx(VoterUpgradeable_Proxy, VoterUpgradeable_Proxy.createV3Gauge('0xCd238eAfAdB112515910f8D09D94A90AC8C180Fe'));
  await logTx(VoterUpgradeable_Proxy, VoterUpgradeable_Proxy.createV3Gauge('0xcE17208bDa21f2d84E1A410f8704ac56038a179d'));
  await logTx(VoterUpgradeable_Proxy, VoterUpgradeable_Proxy.createV3Gauge('0xC0578D20762FD5F4BA6F09124993709ffAa029aB'));
  await logTx(VoterUpgradeable_Proxy, VoterUpgradeable_Proxy.createV3Gauge('0xA83D60b1a9CA6Dd1d0D2d9275c700114F2F3a8d6'));
  await logTx(VoterUpgradeable_Proxy, VoterUpgradeable_Proxy.createV3Gauge('0x45FbF9786cDBDE9E940620F4Af0eb42B76848d17'));
  await logTx(VoterUpgradeable_Proxy, VoterUpgradeable_Proxy.createV3Gauge('0xb09a299E9f7D333420d347EEBE0456Cb0f8545d5'));
  await logTx(VoterUpgradeable_Proxy, VoterUpgradeable_Proxy.createV3Gauge('0xc08fEc05f656690E2658EF8082F909E8d6EDC727'));

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
