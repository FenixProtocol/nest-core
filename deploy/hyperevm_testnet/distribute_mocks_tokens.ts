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
    value: ethers.parseEther('1'),
  });

  const list = [
    '0x7C5a2D63a06A0886ce414DFe7c43cb419e0B3B2a',
    '0x3e3a88Db1B6Fe6CBE76075914293b04fEAF238f2',
    '0xa2c52D2B3D95399f592677c4f249A2DFd2c0d496',
    '0xF89Ae1424f37B807eeE87546d7E1B498c0FD3e96',
    '0x360D5785aE3B2e90F3E753025Ed15F068b6800aE',
    '0x0F5083908AA1e324EC1C3F2B42269Cb6D35fBe51',
    '0xe70ef3e5748D5aEF2E7D586a6C5809D8b5292513',
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
