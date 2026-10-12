import fs from 'fs';
import path from 'path';
import { Contract, ZeroAddress, ZeroHash, getAddress, id } from 'ethers';
import { config, ethers, network } from 'hardhat';

/**
 * Wallet that receives ownership and AccessControl roles.
 *
 * Change this value before running the script if governance moves to a new
 * wallet. Keeping it here (instead of an environment variable) makes the
 * destination explicit and reviewable before a production run.
 */
const ROLE_RECEIVER = '0x4F44dAdBA9AB92374DED8afEE140ebf7EB16766F';

const ACCESS_CONTROL_ABI = [
  'function hasRole(bytes32 role, address account) view returns (bool)',
  'function getRoleAdmin(bytes32 role) view returns (bytes32)',
  'function grantRole(bytes32 role, address account)',
] as const;

const OWNABLE_ABI = [
  'function owner() view returns (address)',
  'function pendingOwner() view returns (address)',
  'function transferOwnership(address newOwner)',
] as const;

type Deployment = {
  name: string;
  address: string;
};

type Role = {
  name: string;
  value: string;
};

type Summary = {
  grantedRoles: number;
  ownershipTransfers: number;
  unchanged: number;
  skipped: number;
};

const namedRole = (name: string, value = name): Role => ({ name, value: id(value) });

/**
 * AccessControl cannot enumerate every role unless a contract also implements
 * AccessControlEnumerable. Keep the non-public/internal roles here so this
 * script grants every role used by the deployed Nest contracts.
 */
function getContractRoles(deploymentNames: string[]): Role[] {
  const roles: Role[] = [{ name: 'DEFAULT_ADMIN_ROLE', value: ZeroHash }];

  for (const deploymentName of deploymentNames) {
    if (deploymentName.startsWith('VoterUpgradeable_')) {
      roles.push(
        namedRole('GOVERNANCE_ROLE'),
        namedRole('VOTER_ADMIN_ROLE'),
        // CompoundEmissionExtension checks these roles on Voter.
        namedRole('COMPOUND_KEEPER_ROLE'),
        namedRole('COMPOUND_EMISSION_EXTENSION_ADMINISTRATOR_ROLE'),
      );
    } else if (deploymentName.startsWith('PairFactoryUpgradeable_')) {
      roles.push(
        namedRole('PAIRS_ADMINISTRATOR_ROLE', 'PAIRS_ADMINISTRATOR'),
        namedRole('FEES_MANAGER_ROLE', 'FEES_MANAGER'),
        namedRole('PAIRS_CREATOR_ROLE', 'PAIRS_CREATOR'),
      );
    } else if (deploymentName.startsWith('FeesVaultFactoryUpgradeable_')) {
      roles.push(namedRole('CLAIM_FEES_CALLER_ROLE'), namedRole('WHITELISTED_CREATOR_ROLE'), namedRole('FEES_VAULT_ADMINISTRATOR_ROLE'));
    } else if (deploymentName.startsWith('CompoundVeNESTManagedNFTStrategyFactoryUpgradeable_')) {
      roles.push(namedRole('STRATEGY_CREATOR_ROLE'));
    } else if (deploymentName.startsWith('ManagedNFTManagerUpgradeable_')) {
      roles.push(namedRole('MANAGED_NFT_ADMIN'));
    } else if (deploymentName.startsWith('VeNestDistributorUpgradeable_')) {
      roles.push(namedRole('DISTRIBUTOR_ROLE'), namedRole('WITHDRAWER_ROLE'));
    } else if (deploymentName.startsWith('GaugeRewader_') || deploymentName.startsWith('GaugeRewarder_')) {
      roles.push(namedRole('REWARDER_ROLE'), namedRole('CLAMER_FOR_ROLE'));
    } else if (deploymentName.startsWith('BribeVeNESTRewardToken_')) {
      roles.push(namedRole('MINTER_ROLE'), namedRole('WHITELIST_ROLE'));
    } else if (deploymentName.startsWith('WHypeAirdrop_')) {
      roles.push(namedRole('ROOT_SETTER_ROLE'));
    } else if (deploymentName === 'TimelockController') {
      roles.push(namedRole('TIMELOCK_ADMIN_ROLE'), namedRole('PROPOSER_ROLE'), namedRole('EXECUTOR_ROLE'), namedRole('CANCELLER_ROLE'));
    }
  }

  return [...new Map(roles.map((role) => [role.value, role])).values()];
}

function isProxyAdmin(deploymentNames: string[]): boolean {
  return deploymentNames.some((name) => name === 'ProxyAdmin' || name.endsWith('_ProxyAdmin'));
}

function loadDeployments(): Deployment[] {
  const deploysPath = path.join(config.paths.root, 'deployments', network.name, 'deploys.json');

  if (!fs.existsSync(deploysPath)) {
    console.log(`No deployments file for network ${network.name}; nothing to do.`);
    return [];
  }

  const parsed: unknown = JSON.parse(fs.readFileSync(deploysPath, 'utf8'));
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`Invalid deployments file: ${deploysPath}`);
  }

  return Object.entries(parsed).flatMap(([name, address]) => {
    if (typeof address !== 'string') {
      console.warn(`[skip] ${name}: deployment address is not a string`);
      return [];
    }

    try {
      return [{ name, address: getAddress(address) }];
    } catch {
      console.warn(`[skip] ${name}: invalid deployment address ${address}`);
      return [];
    }
  });
}

async function tryRead<T>(read: () => Promise<T>): Promise<T | undefined> {
  try {
    return await read();
  } catch {
    return undefined;
  }
}

async function grantAccessControlRoles(
  contractAddress: string,
  deploymentNames: string[],
  signerAddress: string,
  receiver: string,
  summary: Summary,
): Promise<boolean> {
  const accessControl = new Contract(contractAddress, ACCESS_CONTROL_ABI, await ethers.getSigner(signerAddress));
  const isAccessControl = await tryRead(() => accessControl.hasRole(ZeroHash, signerAddress) as Promise<boolean>);

  if (isAccessControl === undefined) {
    return false;
  }

  for (const role of getContractRoles(deploymentNames)) {
    const receiverHasRole = await tryRead(() => accessControl.hasRole(role.value, receiver) as Promise<boolean>);
    if (receiverHasRole === true) {
      console.log(`[unchanged] ${deploymentNames.join(', ')}: receiver already has ${role.name}`);
      summary.unchanged++;
      continue;
    }

    const adminRole = await tryRead(() => accessControl.getRoleAdmin(role.value) as Promise<string>);
    if (adminRole === undefined) {
      console.warn(`[skip] ${deploymentNames.join(', ')}: cannot read the admin for ${role.name}`);
      summary.skipped++;
      continue;
    }

    const signerCanGrant = await tryRead(() => accessControl.hasRole(adminRole, signerAddress) as Promise<boolean>);
    if (!signerCanGrant) {
      console.warn(`[skip] ${deploymentNames.join(', ')}: signer is not an admin for ${role.name}`);
      summary.skipped++;
      continue;
    }

    const tx = await accessControl.grantRole(role.value, receiver);
    console.log(`[grant] ${deploymentNames.join(', ')}: ${role.name}; tx ${tx.hash}`);
    await tx.wait();
    summary.grantedRoles++;
  }

  return true;
}

async function transferOwnership(
  contractAddress: string,
  deploymentNames: string[],
  signerAddress: string,
  receiver: string,
  summary: Summary,
): Promise<boolean> {
  if (isProxyAdmin(deploymentNames)) {
    console.log(`[skip] ${deploymentNames.join(', ')}: ProxyAdmin ownership is intentionally unchanged`);
    summary.skipped++;
    return true;
  }

  const ownable = new Contract(contractAddress, OWNABLE_ABI, await ethers.getSigner(signerAddress));
  const owner = await tryRead(() => ownable.owner() as Promise<string>);
  if (owner === undefined) {
    return false;
  }

  if (owner.toLowerCase() === receiver.toLowerCase()) {
    console.log(`[unchanged] ${deploymentNames.join(', ')}: receiver already owns the contract`);
    summary.unchanged++;
    return true;
  }

  const pendingOwner = await tryRead(() => ownable.pendingOwner() as Promise<string>);
  if (pendingOwner?.toLowerCase() === receiver.toLowerCase()) {
    console.log(`[unchanged] ${deploymentNames.join(', ')}: receiver is already the pending owner and must call acceptOwnership()`);
    summary.unchanged++;
    return true;
  }

  if (owner.toLowerCase() !== signerAddress.toLowerCase()) {
    // A zero owner is expected for disabled implementation contracts.
    if (owner !== ZeroAddress) {
      console.warn(`[skip] ${deploymentNames.join(', ')}: signer is not the current owner (${owner})`);
    }
    summary.skipped++;
    return true;
  }

  const tx = await ownable.transferOwnership(receiver);
  console.log(`[ownership] ${deploymentNames.join(', ')}: transfer submitted; tx ${tx.hash}`);
  await tx.wait();
  summary.ownershipTransfers++;

  if (pendingOwner !== undefined) {
    console.log(`  ${receiver} must call acceptOwnership() to complete this two-step transfer.`);
  }

  return true;
}

async function main() {
  const receiver = getAddress(ROLE_RECEIVER);
  if (receiver === ZeroAddress) {
    throw new Error('ROLE_RECEIVER must not be the zero address');
  }

  const deployments = loadDeployments();
  if (deployments.length === 0) {
    return;
  }

  const [signer] = await ethers.getSigners();
  if (!signer) {
    throw new Error(`No signer configured for network ${network.name}`);
  }

  const signerAddress = await signer.getAddress();
  const deploymentsByAddress = new Map<string, { address: string; names: string[] }>();

  for (const deployment of deployments) {
    const key = deployment.address.toLowerCase();
    const existing = deploymentsByAddress.get(key);
    if (existing) {
      existing.names.push(deployment.name);
    } else {
      deploymentsByAddress.set(key, { address: deployment.address, names: [deployment.name] });
    }
  }

  const summary: Summary = { grantedRoles: 0, ownershipTransfers: 0, unchanged: 0, skipped: 0 };
  let contractsWithCode = 0;

  console.log(`Network: ${network.name}`);
  console.log(`Signer: ${signerAddress}`);
  console.log(`Role/ownership receiver: ${receiver}`);

  for (const deployment of deploymentsByAddress.values()) {
    const code = await ethers.provider.getCode(deployment.address);
    if (code === '0x') {
      console.log(`[skip] ${deployment.names.join(', ')}: no contract deployed at ${deployment.address}`);
      summary.skipped++;
      continue;
    }

    contractsWithCode++;
    const handledAccessControl = await grantAccessControlRoles(deployment.address, deployment.names, signerAddress, receiver, summary);
    const handledOwnership = await transferOwnership(deployment.address, deployment.names, signerAddress, receiver, summary);

    if (!handledAccessControl && !handledOwnership) {
      console.log(`[unchanged] ${deployment.names.join(', ')}: no AccessControl or Ownable interface`);
      summary.unchanged++;
    }
  }

  if (contractsWithCode === 0) {
    console.log(`No deployed contracts found on ${network.name}; nothing to do.`);
    return;
  }

  console.log(
    `Done. Granted roles: ${summary.grantedRoles}; ownership transfers: ${summary.ownershipTransfers}; unchanged: ${summary.unchanged}; skipped: ${summary.skipped}.`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
