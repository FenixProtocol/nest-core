import { Contract } from 'ethers';
import { ethers } from 'hardhat';
import { AliasDeployedContracts, getDeployedContractsAddressList, saveToDeployedContractsAddressList } from '../../utils/Deploy';
import { InstanceName } from '../../utils/Names';
import { assertAddressEquals, getDeploymentContext, requireDeploymentAddress } from './_shared';

const WHYPE_ADDRESS = '0xbA876237B0F021A6c6D852d6c26E107997cC5E81';
const USDC_ADDRESS = '0xb47c4C8F73F009CC0C0d3f92B388d13E293F0B65';
const POOL_ALIAS = 'V2Pool_WHYPE_USDC_Volatile';
const HYPE_TO_WRAP = ethers.parseEther('0.01');
const USDC_PER_HYPE = 78n;

const TOKEN_ABI = [
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address,address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
  'function deposit() payable',
];

async function ensureAllowance(token: Contract, owner: string, spender: string, amount: bigint): Promise<void> {
  const allowance: bigint = await token.allowance(owner, spender);
  if (allowance >= amount) return;

  // Some ERC-20s require an existing allowance to be cleared before changing it.
  if (allowance > 0n) {
    await (await token.approve(spender, 0n)).wait();
  }
  await (await token.approve(spender, amount)).wait();
}

async function main() {
  const { deployer, wrappedNative } = await getDeploymentContext();
  const deployments = await getDeployedContractsAddressList();
  const whypeAddress = ethers.getAddress(WHYPE_ADDRESS);
  const usdcAddress = ethers.getAddress(USDC_ADDRESS);
  const factoryAddress = requireDeploymentAddress(deployments, AliasDeployedContracts.PairFactoryUpgradeable_Proxy);
  const routerAddress = requireDeploymentAddress(deployments, AliasDeployedContracts.RouterV2);

  assertAddressEquals('WHYPE', wrappedNative, whypeAddress);
  assertAddressEquals('Configured WHYPE', requireDeploymentAddress(deployments, AliasDeployedContracts.WrappedNative), whypeAddress);
  if ((await ethers.provider.getCode(usdcAddress)) === '0x') throw new Error(`No USDC contract at ${usdcAddress}`);
  if ((await ethers.provider.getCode(factoryAddress)) === '0x') throw new Error(`No PairFactory contract at ${factoryAddress}`);
  if ((await ethers.provider.getCode(routerAddress)) === '0x') throw new Error(`No RouterV2 contract at ${routerAddress}`);

  const whype = new ethers.Contract(whypeAddress, TOKEN_ABI, deployer);
  const usdc = new ethers.Contract(usdcAddress, TOKEN_ABI, deployer);
  const factory = await ethers.getContractAt(InstanceName.PairFactoryUpgradeable, factoryAddress, deployer);
  const router = await ethers.getContractAt(InstanceName.RouterV2, routerAddress, deployer);

  assertAddressEquals('RouterV2.factory', await router.factory(), factoryAddress);
  assertAddressEquals('RouterV2.wETH', await router.wETH(), whypeAddress);
  if ((await usdc.symbol()) !== 'USDC' || (await usdc.decimals()) !== 6n) {
    throw new Error(`Expected a 6-decimal USDC token at ${usdcAddress}`);
  }

  // Both amounts use token base units; 0.01 WHYPE * 78 USDC/WHYPE = 0.78 USDC.
  const usdcAmount = (HYPE_TO_WRAP * USDC_PER_HYPE * 10n ** 6n) / 10n ** 18n;
  if ((await usdc.balanceOf(deployer.address)) < usdcAmount) {
    throw new Error(`Deployer needs at least ${ethers.formatUnits(usdcAmount, 6)} USDC`);
  }
  if ((await ethers.provider.getBalance(deployer.address)) <= HYPE_TO_WRAP) {
    throw new Error('Deployer needs more than 0.01 HYPE to cover wrapping and transaction gas');
  }

  let poolAddress = await factory.getPair(whypeAddress, usdcAddress, false);
  if (poolAddress === ethers.ZeroAddress) {
    if (!(await factory.isPublicPoolCreationMode()) && !(await factory.hasRole(await factory.PAIRS_CREATOR_ROLE(), deployer.address))) {
      throw new Error(`Deployer ${deployer.address} lacks PAIRS_CREATOR_ROLE`);
    }
    const tx = await factory.createPair(whypeAddress, usdcAddress, false);
    console.log(`Creating volatile WHYPE/USDC pool: ${tx.hash}`);
    await tx.wait();
    poolAddress = await factory.getPair(whypeAddress, usdcAddress, false);
    if (poolAddress === ethers.ZeroAddress) throw new Error('PairFactory returned no pool after creation');
  }

  const pool = await ethers.getContractAt(InstanceName.Pair, poolAddress, deployer);
  assertAddressEquals('Pool.factory', await pool.factory(), factoryAddress);
  if (await pool.isStable()) throw new Error(`Pool ${poolAddress} is stable, expected volatile`);
  const token0 = await pool.token0();
  const token1 = await pool.token1();
  const expectedTokens = [whypeAddress.toLowerCase(), usdcAddress.toLowerCase()].sort();
  if ([token0.toLowerCase(), token1.toLowerCase()].sort().join(',') !== expectedTokens.join(',')) {
    throw new Error(`Pool ${poolAddress} has unexpected tokens`);
  }

  const [reserve0, reserve1] = await pool.getReserves();
  if (reserve0 !== 0n || reserve1 !== 0n || (await whype.balanceOf(poolAddress)) !== 0n || (await usdc.balanceOf(poolAddress)) !== 0n) {
    throw new Error(`Pool ${poolAddress} already has liquidity or token balances; refusing to change its price`);
  }

  const wrapTx = await whype.deposit({ value: HYPE_TO_WRAP });
  console.log(`Wrapping 0.01 HYPE: ${wrapTx.hash}`);
  await wrapTx.wait();
  await ensureAllowance(whype, deployer.address, routerAddress, HYPE_TO_WRAP);
  await ensureAllowance(usdc, deployer.address, routerAddress, usdcAmount);

  const deadline = (await ethers.provider.getBlock('latest'))!.timestamp + 600;
  const liquidityTx = await router.addLiquidity(
    whypeAddress,
    usdcAddress,
    false,
    HYPE_TO_WRAP,
    usdcAmount,
    HYPE_TO_WRAP,
    usdcAmount,
    deployer.address,
    deadline,
  );
  console.log(`Adding 0.01 WHYPE and ${ethers.formatUnits(usdcAmount, 6)} USDC: ${liquidityTx.hash}`);
  await liquidityTx.wait();

  const [finalReserve0, finalReserve1] = await pool.getReserves();
  const whypeReserve = token0.toLowerCase() === whypeAddress.toLowerCase() ? finalReserve0 : finalReserve1;
  const usdcReserve = token0.toLowerCase() === usdcAddress.toLowerCase() ? finalReserve0 : finalReserve1;
  if (whypeReserve !== HYPE_TO_WRAP || usdcReserve !== usdcAmount || (await pool.balanceOf(deployer.address)) === 0n) {
    throw new Error(`Pool ${poolAddress} did not receive the expected liquidity`);
  }
  console.log(`Volatile WHYPE/USDC pool: ${poolAddress}`);
  console.log('Initial price: 78 USDC per WHYPE');
  console.log(`LP recipient: ${deployer.address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
