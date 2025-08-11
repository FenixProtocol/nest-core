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

async function main() {
  const [deployer] = await ethers.getSigners();

  const Tasks = [
    {
      contract: InstanceName.ERC20Mock,
      saveAlias: 'ERC20_FakeUSDT',
      constructorArguments: ['Fake USDT', 'fUSDT', 6],
    },
    {
      contract: InstanceName.ERC20Mock,
      saveAlias: 'ERC20_FakeUSDC',
      constructorArguments: ['Fake USDC', 'fUSDC', 18],
    },
    {
      contract: InstanceName.ERC20Mock,
      saveAlias: 'ERC20_FakeWBTC',
      constructorArguments: ['Fake Wrapped BTC', 'wBTC', 8],
    },
    {
      contract: InstanceName.ERC20Mock,
      saveAlias: 'ERC20_TOK18',
      constructorArguments: ['Fake TOK18', 'fTOK18', 18],
    },
    {
      contract: InstanceName.ERC20Mock,
      saveAlias: 'ERC20_TOK9',
      constructorArguments: ['Fake TOK9', 'TOK9', 9],
    },
    {
      contract: InstanceName.ERC20Mock,
      saveAlias: 'ERC20_FakeUniV2',
      constructorArguments: ['Fake Uniswap Token', 'fUNI', 18],
    },
  ];
  for await (const task of Tasks) {
    let contract = await deploy({
      name: task.contract,
      deployer: deployer,
      constructorArguments: task.constructorArguments,
      saveAlias: task.saveAlias,
      verify: false,
    });
    let TypedContract = await ethers.getContractAt('ERC20Mock', contract.target);
    await logTx(TypedContract, TypedContract.mint(deployer, BigInt(1000000) * BigInt(10) ** BigInt(task.constructorArguments[2])));
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
