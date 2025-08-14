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

  const TARGET = '0x7869E6BD4b7A430ede2bf7Ca570341CBeEa59517';
  await deployer.sendTransaction({
    to: TARGET,
    value: ethers.parseEther('0.01'),
  });

  const DeployedContracts = await getDeployedContractsAddressList();

  const list = [
    DeployedContracts['ERC20_FakeUSDT'],
    DeployedContracts['ERC20_FakeUSDC'],
    DeployedContracts['ERC20_FakeWBTC'],
    DeployedContracts['ERC20_TOK18'],
    DeployedContracts['ERC20_TOK9'],
    DeployedContracts['ERC20_FakeUniV2'],
    DeployedContracts['Nest'],
  ];

  for await (const element of list) {
    let fake = await ethers.getContractAt('ERC20Mock', element);
    const decimals = await fake.decimals();
    await logTx(fake, fake.transfer(TARGET, 10000n * BigInt(10) ** BigInt(decimals)));
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
