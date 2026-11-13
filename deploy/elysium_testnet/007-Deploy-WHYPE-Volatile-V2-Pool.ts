import { ethers } from 'hardhat';
import { AliasDeployedContracts, getDeployedContractsAddressList, saveToDeployedContractsAddressList } from '../../utils/Deploy';
import { InstanceName } from '../../utils/Names';
import { verify } from '../../utils/Verify';
import { assertAddressEquals, getDeploymentContext, requireDeploymentAddress } from './_shared';

const TOKEN_ADDRESS = '0x71a676b41569D2C3B19a3F182b1FAEb0a06dA3ff';
const POOL_ALIAS = 'V2Pool_WHYPE_71a676b4_Volatile';
const IS_STABLE = false;

const ERC20_METADATA_ABI = ['function symbol() view returns (string)', 'function decimals() view returns (uint8)'];

function isAlreadyVerifiedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.toLowerCase().includes('already verified');
}

async function validateToken(address: string, label: string): Promise<void> {
  if ((await ethers.provider.getCode(address)) === '0x') {
    throw new Error(`${label} has no deployed bytecode: ${address}`);
  }

  const token = new ethers.Contract(address, ERC20_METADATA_ABI, ethers.provider);
  try {
    const [symbol, decimals] = await Promise.all([token.symbol(), token.decimals()]);
    console.log(`${label}: ${address} (${symbol}, ${decimals.toString()} decimals)`);
  } catch {
    throw new Error(`${label} does not expose the ERC-20 symbol/decimals interface required by Pair.initialize(): ${address}`);
  }
}

async function validatePool(poolAddress: string, pairFactoryAddress: string, whype: string, token: string): Promise<void> {
  if ((await ethers.provider.getCode(poolAddress)) === '0x') {
    throw new Error(`No pool bytecode found at ${poolAddress}`);
  }

  const pool = await ethers.getContractAt(InstanceName.Pair, poolAddress);
  const expectedTokens = [whype.toLowerCase(), token.toLowerCase()].sort();
  const actualTokens = [(await pool.token0()).toLowerCase(), (await pool.token1()).toLowerCase()].sort();

  if (actualTokens[0] !== expectedTokens[0] || actualTokens[1] !== expectedTokens[1]) {
    throw new Error(`Pool ${poolAddress} contains unexpected tokens: ${actualTokens.join(', ')}`);
  }
  if (await pool.isStable()) {
    throw new Error(`Pool ${poolAddress} is stable; expected a volatile V2 pool`);
  }

  assertAddressEquals('Pool.factory', await pool.factory(), pairFactoryAddress);
}

async function verifyPool(poolAddress: string, pairImplementation: string): Promise<void> {
  // PairFactory deploys pools as EIP-1167 clones. Verify that this pool delegates
  // to the registered Pair implementation, whose source is what explorers display.
  const expectedRuntime = `0x363d3d373d3d3d363d73${pairImplementation.slice(2)}5af43d82803e903d91602b57fd5bf3`.toLowerCase();
  const actualRuntime = (await ethers.provider.getCode(poolAddress)).toLowerCase();
  if (actualRuntime !== expectedRuntime) {
    throw new Error(`Pool ${poolAddress} is not an EIP-1167 clone of Pair implementation ${pairImplementation}`);
  }

  console.log(`Pool clone bytecode verified against Pair implementation ${pairImplementation}.`);
  try {
    await verify(pairImplementation, [], true, 1000);
    console.log('Pair implementation source verified successfully.');
  } catch (error) {
    if (isAlreadyVerifiedError(error)) {
      console.log('Pair implementation source is already verified.');
    } else {
      throw error;
    }
  }
}

async function main() {
  const { deployer, wrappedNative: whype } = await getDeploymentContext();
  const deployments = await getDeployedContractsAddressList();
  const pairFactoryAddress = requireDeploymentAddress(deployments, AliasDeployedContracts.PairFactoryUpgradeable_Proxy);
  const pairImplementation = requireDeploymentAddress(deployments, AliasDeployedContracts.Pair_Implementation);
  const storedWhype = requireDeploymentAddress(deployments, AliasDeployedContracts.WrappedNative);
  const tokenAddress = ethers.getAddress(TOKEN_ADDRESS);

  assertAddressEquals('Configured WHYPE', whype, storedWhype);
  if (whype.toLowerCase() === tokenAddress.toLowerCase()) {
    throw new Error('WHYPE and the paired token must have different addresses');
  }

  await Promise.all([validateToken(whype, 'WHYPE'), validateToken(tokenAddress, 'Paired token')]);

  const pairFactory = await ethers.getContractAt(InstanceName.PairFactoryUpgradeable, pairFactoryAddress, deployer);
  let poolAddress = await pairFactory.getPair(whype, tokenAddress, IS_STABLE);

  if (poolAddress === ethers.ZeroAddress) {
    const publicCreationEnabled = await pairFactory.isPublicPoolCreationMode();
    const pairsCreatorRole = await pairFactory.PAIRS_CREATOR_ROLE();
    if (!publicCreationEnabled && !(await pairFactory.hasRole(pairsCreatorRole, deployer.address))) {
      throw new Error(`${deployer.address} cannot create this pool: public creation is disabled and the signer lacks PAIRS_CREATOR_ROLE`);
    }

    const transaction = await pairFactory.createPair(whype, tokenAddress, IS_STABLE);
    console.log(`Creating volatile WHYPE V2 pool; tx ${transaction.hash}`);
    await transaction.wait();

    poolAddress = await pairFactory.getPair(whype, tokenAddress, IS_STABLE);
    if (poolAddress === ethers.ZeroAddress) {
      throw new Error('PairFactory returned the zero address after pool creation');
    }
  } else {
    console.log(`Volatile WHYPE V2 pool already exists: ${poolAddress}`);
  }

  await validatePool(poolAddress, pairFactoryAddress, whype, tokenAddress);
  await saveToDeployedContractsAddressList(POOL_ALIAS, poolAddress);
  await verifyPool(poolAddress, pairImplementation);

  console.log('Volatile V2 pool ready:');
  console.log(`  WHYPE: ${whype}`);
  console.log(`  Paired token: ${tokenAddress}`);
  console.log(`  Pool: ${poolAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
