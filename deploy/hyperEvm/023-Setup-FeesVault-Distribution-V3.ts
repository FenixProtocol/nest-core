import { ethers } from 'hardhat';
import { AliasDeployedContracts, getDeployedContractsAddressList, logTx } from '../../utils/Deploy';
import { InstanceName } from '../../utils/Names';

async function main() {
  const [deployer] = await ethers.getSigners();

  const DeployedContracts = await getDeployedContractsAddressList();

  const FeesVaultFactoryUpgradeable_Proxy = await ethers.getContractAt(
    InstanceName.FeesVaultFactoryUpgradeable,
    DeployedContracts[AliasDeployedContracts.FeesVaultFactoryUpgradeable_Proxy],
  );

  await logTx(FeesVaultFactoryUpgradeable_Proxy, FeesVaultFactoryUpgradeable_Proxy.setDistributionConfigForCreator(
    "0xF77Bd082c627aA54591cF2f2EaA811fd1AB3b1F3",
    {
      toGaugeRate: 9700,
      recipients: ["0xe8c4C070baa6117eB3186F8AE6ccEB7406707ea7"],
      rates: [300]
    }
  ));

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
