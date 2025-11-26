import { ethers } from 'hardhat';
import { AliasDeployedContracts, deploy, deployProxy, getDeployedContractsAddressList, getProxyAdminAddress, logTx } from '../../utils/Deploy';
import { InstanceName } from '../../utils/Names';

async function main() {
  const DeployedContracts = await getDeployedContractsAddressList();

  const FeesVaultFactoryUpgradeable_Proxy = await ethers.getContractAt(
    InstanceName.FeesVaultFactoryUpgradeable,
    DeployedContracts[AliasDeployedContracts.FeesVaultFactoryUpgradeable_Proxy],
  );
  
  let WHYPE_NEST = "0x9AA281B23341cE69d4b1500367a43CFc42005538"
  let feesVault = await FeesVaultFactoryUpgradeable_Proxy.getVaultForPool(WHYPE_NEST)
  await logTx(FeesVaultFactoryUpgradeable_Proxy, FeesVaultFactoryUpgradeable_Proxy.setCustomDistributionConfig(feesVault, {
    toGaugeRate: 10000,
    recipients: [],
    rates: []
  })
  );

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
