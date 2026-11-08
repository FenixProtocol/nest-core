import { ethers } from 'hardhat';
import { AliasDeployedContracts, getDeployedContractsAddressList } from '../../utils/Deploy';
import { InstanceName } from '../../utils/Names';
import { DISTRIBUTION_PRECISION, getDeploymentContext, requireDeploymentAddress } from './_shared';

const FEE_RECIPIENT = ethers.getAddress('0xdB180c83029577A1Cb323542EC796Fa4cC7b8F51');

async function main() {
  const { deployer } = await getDeploymentContext();
  const deployments = await getDeployedContractsAddressList();
  const factoryAddress = requireDeploymentAddress(deployments, AliasDeployedContracts.FeesVaultFactoryUpgradeable_Proxy);

  if ((await ethers.provider.getCode(factoryAddress)) === '0x') {
    throw new Error(`No FeesVaultFactory contract at ${factoryAddress}`);
  }

  const factory = await ethers.getContractAt(InstanceName.FeesVaultFactoryUpgradeable, factoryAddress, deployer);
  const matchesExpectedConfig = (config: { toGaugeRate: bigint; recipients: string[]; rates: bigint[] }) =>
    config.toGaugeRate === 0n &&
    config.recipients.length === 1 &&
    config.recipients[0].toLowerCase() === FEE_RECIPIENT.toLowerCase() &&
    config.rates.length === 1 &&
    config.rates[0] === DISTRIBUTION_PRECISION;

  if (matchesExpectedConfig(await factory.defaultDistributionConfig())) {
    console.log(`Default fee distribution is already set to ${FEE_RECIPIENT}`);
    return;
  }

  const administratorRole = await factory.FEES_VAULT_ADMINISTRATOR_ROLE();
  if (!(await factory.hasRole(administratorRole, deployer.address))) {
    throw new Error(`Deployer ${deployer.address} lacks FEES_VAULT_ADMINISTRATOR_ROLE`);
  }

  const tx = await factory.setDefaultDistributionConfig({
    toGaugeRate: 0n,
    recipients: [FEE_RECIPIENT],
    rates: [DISTRIBUTION_PRECISION],
  });
  console.log(`Setting default fee distribution on FeesVaultFactory ${factoryAddress}: ${tx.hash}`);
  await tx.wait();

  if (!matchesExpectedConfig(await factory.defaultDistributionConfig())) {
    throw new Error('Default fee distribution does not match the requested configuration');
  }
  console.log(`Default fee distribution set: 100% to ${FEE_RECIPIENT}, 0% to gauges.`);
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
