import { ethers, network } from 'hardhat';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';

export const ELYSIUM_NETWORK_NAME = 'elysium_testnet';
export const ELYSIUM_CHAIN_ID = 99801n;

export const VOLATILE_SWAP_FEE = 30n;
export const STABLE_SWAP_FEE = 4n;
export const PROTOCOL_FEE_SHARE = 1000n;
export const DISTRIBUTION_PRECISION = 10000n;

const WRAPPED_NATIVE_ABI = ['function decimals() view returns (uint8)', 'function deposit() payable', 'function withdraw(uint256 amount)'];

export interface DeploymentContext {
  deployer: HardhatEthersSigner;
  wrappedNative: string;
}

function requireEnvironmentVariable(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function validatePrivateKey(): void {
  const privateKey = requireEnvironmentVariable('DEV_PK');
  if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    throw new Error('DEV_PK must be a 32-byte hex private key prefixed with 0x');
  }
}

async function validateWrappedNative(deployer: HardhatEthersSigner): Promise<string> {
  const configuredAddress = requireEnvironmentVariable('ELYSIUM_WRAPPED_NATIVE');
  let wrappedNative: string;

  try {
    wrappedNative = ethers.getAddress(configuredAddress);
  } catch {
    throw new Error(`ELYSIUM_WRAPPED_NATIVE is not a valid address: ${configuredAddress}`);
  }

  if (wrappedNative === ethers.ZeroAddress) {
    throw new Error('ELYSIUM_WRAPPED_NATIVE must not be the zero address');
  }

  const code = await ethers.provider.getCode(wrappedNative);
  if (code === '0x') {
    throw new Error(`ELYSIUM_WRAPPED_NATIVE has no deployed bytecode: ${wrappedNative}`);
  }

  const wrapper = new ethers.Contract(wrappedNative, WRAPPED_NATIVE_ABI, deployer);
  const decimals = await wrapper.decimals();
  if (decimals !== 18n) {
    throw new Error(`ELYSIUM_WRAPPED_NATIVE must use 18 decimals; received ${decimals.toString()}`);
  }

  try {
    await wrapper.deposit.staticCall({ value: 0 });
    await wrapper.withdraw.staticCall(0);
  } catch {
    throw new Error(`ELYSIUM_WRAPPED_NATIVE does not expose a compatible deposit/withdraw interface: ${wrappedNative}`);
  }

  return wrappedNative;
}

export async function getDeploymentContext(): Promise<DeploymentContext> {
  if (network.name !== ELYSIUM_NETWORK_NAME) {
    throw new Error(`This deployment flow must run with --network ${ELYSIUM_NETWORK_NAME}; received ${network.name}`);
  }

  validatePrivateKey();

  const providerNetwork = await ethers.provider.getNetwork();
  if (providerNetwork.chainId !== ELYSIUM_CHAIN_ID) {
    throw new Error(`Expected chain ID ${ELYSIUM_CHAIN_ID.toString()}, received ${providerNetwork.chainId.toString()}`);
  }

  const [deployer] = await ethers.getSigners();
  if (!deployer) {
    throw new Error('No deployment signer is configured');
  }

  const balance = await ethers.provider.getBalance(deployer.address);
  if (balance === 0n) {
    throw new Error(`Deployment signer ${deployer.address} has no native HYPE for gas`);
  }

  const wrappedNative = await validateWrappedNative(deployer);

  console.log(`Network: ${network.name} (${providerNetwork.chainId.toString()})`);
  console.log(`Deployer/admin/treasury: ${deployer.address}`);
  console.log(`Wrapped native token: ${wrappedNative}`);

  return { deployer, wrappedNative };
}

export function requireDeploymentAddress(deployments: Record<string, string>, alias: string): string {
  const address = deployments[alias];
  if (!address) {
    throw new Error(`Missing ${alias} in deployments/${ELYSIUM_NETWORK_NAME}/deploys.json`);
  }

  try {
    return ethers.getAddress(address);
  } catch {
    throw new Error(`Invalid address stored for ${alias}: ${address}`);
  }
}

export function assertAddressEquals(label: string, actual: string, expected: string): void {
  if (actual.toLowerCase() !== expected.toLowerCase()) {
    throw new Error(`${label}: expected ${expected}, received ${actual}`);
  }
}
