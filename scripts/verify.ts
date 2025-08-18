import { getDeployedDataFromDeploys, getDeploysData } from './utils';
import hre from 'hardhat';
import { ethers } from 'hardhat';
import { getDeployedContractsAddressList, getProxyAdminAddress } from '../utils/Deploy';

async function main() {
  const DeployedContracts = await getDeployedContractsAddressList();
  const ProxyAdmin = await getProxyAdminAddress();
  const keys = Object.keys(DeployedContracts);

  for await (const key of keys) {
    if (key.endsWith('_Proxy')) {
      let addr = DeployedContracts[key];
      console.log('Target:', addr);
      try {
        let ke = key.replace('Implementation', 'Proxy');
        console.log('\targs:', ke, ProxyAdmin, '0x');

        await hre.run('verify:verify', {
          address: addr,
          constructorArguments: [DeployedContracts[ke], ProxyAdmin, '0x'],
        });
      } catch (err) {
        console.log(err);
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
