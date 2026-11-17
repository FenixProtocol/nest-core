import { Contract } from 'ethers';
import { ethers, network } from 'hardhat';
import { AliasDeployedContracts, deploy, getDeployedContractsAddressList, saveToDeployedContractsAddressList } from '../utils/Deploy';
import { InstanceName } from '../utils/Names';

const TOKEN_DECIMALS = 18;

const TOKEN_A = {
  name: 'Mock Token A',
  symbol: 'MTA',
  saveAlias: 'ERC20_MockTokenA',
} as const;

const TOKEN_B = {
  name: 'Mock Token B',
  symbol: 'MTB',
  saveAlias: 'ERC20_MockTokenB',
} as const;

const VOLATILE_POOL_ALIAS = 'V2Pool_MTA_MTB_Volatile';
const STABLE_POOL_ALIAS = 'V2Pool_MTA_MTB_Stable';

async function createPair(pairFactory: Contract, tokenA: string, tokenB: string, stable: boolean): Promise<string> {
  const poolType = stable ? 'stable' : 'volatile';
  const transaction = await pairFactory.createPair(tokenA, tokenB, stable);
  console.log(`Creating ${poolType} V2 pool; tx ${transaction.hash}`);
  await transaction.wait();

  const pairAddress = await pairFactory.getPair(tokenA, tokenB, stable);
  if (pairAddress === ethers.ZeroAddress) {
    throw new Error(`PairFactory returned the zero address for the ${poolType} pool`);
  }

  console.log(`${poolType[0].toUpperCase()}${poolType.slice(1)} V2 pool: ${pairAddress}`);
  return pairAddress;
}

async function main() {
  const [deployer] = await ethers.getSigners();
  if (!deployer) {
    throw new Error(`No deployer configured for network ${network.name}`);
  }

  const deployments = await getDeployedContractsAddressList();
  const pairFactoryAddress = deployments[AliasDeployedContracts.PairFactoryUpgradeable_Proxy];
  if (!pairFactoryAddress || !ethers.isAddress(pairFactoryAddress)) {
    throw new Error(
      `Missing or invalid ${AliasDeployedContracts.PairFactoryUpgradeable_Proxy} in deployments/${network.name}/deploys.json`,
    );
  }

  if ((await ethers.provider.getCode(pairFactoryAddress)) === '0x') {
    throw new Error(`No PairFactory contract deployed at ${pairFactoryAddress} on ${network.name}`);
  }

  const pairFactory = await ethers.getContractAt(InstanceName.PairFactoryUpgradeable, pairFactoryAddress, deployer);
  const isPublicPoolCreation = await pairFactory.isPublicPoolCreationMode();
  const pairsCreatorRole = await pairFactory.PAIRS_CREATOR_ROLE();
  if (!isPublicPoolCreation && !(await pairFactory.hasRole(pairsCreatorRole, deployer.address))) {
    throw new Error(`${deployer.address} cannot create V2 pools: public creation is disabled and the signer lacks PAIRS_CREATOR_ROLE`);
  }

  console.log(`Network: ${network.name}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`PairFactory: ${pairFactoryAddress}`);

  // ERC20Mock.mint(address,uint256) is permissionless, so anyone can mint both tokens.
  const tokenA = await deploy({
    name: InstanceName.ERC20Mock,
    deployer,
    constructorArguments: [TOKEN_A.name, TOKEN_A.symbol, TOKEN_DECIMALS],
    saveAlias: TOKEN_A.saveAlias,
    verify: false,
  });
  const tokenB = await deploy({
    name: InstanceName.ERC20Mock,
    deployer,
    constructorArguments: [TOKEN_B.name, TOKEN_B.symbol, TOKEN_DECIMALS],
    saveAlias: TOKEN_B.saveAlias,
    verify: false,
  });

  const tokenAAddress = await tokenA.getAddress();
  const tokenBAddress = await tokenB.getAddress();

  const volatilePool = await createPair(pairFactory, tokenAAddress, tokenBAddress, false);
  await saveToDeployedContractsAddressList(VOLATILE_POOL_ALIAS, volatilePool);

  const stablePool = await createPair(pairFactory, tokenAAddress, tokenBAddress, true);
  await saveToDeployedContractsAddressList(STABLE_POOL_ALIAS, stablePool);

  console.log('Mock tokens and V2 pools deployed successfully:');
  console.log(`  ${TOKEN_A.symbol}: ${tokenAAddress}`);
  console.log(`  ${TOKEN_B.symbol}: ${tokenBAddress}`);
  console.log(`  Volatile pool: ${volatilePool}`);
  console.log(`  Stable pool: ${stablePool}`);
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
