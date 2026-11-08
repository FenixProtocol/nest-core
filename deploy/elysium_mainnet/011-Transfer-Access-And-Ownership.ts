import { Contract } from 'ethers';
import { ethers } from 'hardhat';
import { AliasDeployedContracts, getDeployedContractsAddressList } from '../../utils/Deploy';
import { InstanceName } from '../../utils/Names';
import { getDeploymentContext, requireDeploymentAddress } from './_shared';

const NEW_OWNER = ethers.getAddress('0xdB180c83029577A1Cb323542EC796Fa4cC7b8F51');

interface RoleTransfer {
  contract: Contract;
  contractName: string;
  role: string;
  roleName: string;
  deployerHasRole: boolean;
}

async function main() {
  const { deployer } = await getDeploymentContext();
  if (deployer.address.toLowerCase() === NEW_OWNER.toLowerCase()) {
    throw new Error('The new owner must differ from the deployer');
  }

  const deployments = await getDeployedContractsAddressList();
  const pairFactoryAddress = requireDeploymentAddress(deployments, AliasDeployedContracts.PairFactoryUpgradeable_Proxy);
  const feesVaultFactoryAddress = requireDeploymentAddress(deployments, AliasDeployedContracts.FeesVaultFactoryUpgradeable_Proxy);
  const rewarderAddress = requireDeploymentAddress(deployments, AliasDeployedContracts.LPRewarder_Proxy);
  const proxyAdminAddress = requireDeploymentAddress(deployments, AliasDeployedContracts.ProxyAdmin);

  for (const [name, address] of [
    ['PairFactory', pairFactoryAddress],
    ['FeesVaultFactory', feesVaultFactoryAddress],
    ['LPRewarder', rewarderAddress],
    ['ProxyAdmin', proxyAdminAddress],
  ]) {
    if ((await ethers.provider.getCode(address)) === '0x') {
      throw new Error(`No ${name} contract at ${address}`);
    }
  }

  const pairFactory = await ethers.getContractAt(InstanceName.PairFactoryUpgradeable, pairFactoryAddress, deployer);
  const feesVaultFactory = await ethers.getContractAt(InstanceName.FeesVaultFactoryUpgradeable, feesVaultFactoryAddress, deployer);
  const rewarder = await ethers.getContractAt(InstanceName.LPRewarder, rewarderAddress, deployer);
  const proxyAdmin = await ethers.getContractAt(InstanceName.ProxyAdmin, proxyAdminAddress, deployer);

  const owner = await proxyAdmin.owner();
  if (owner.toLowerCase() !== deployer.address.toLowerCase() && owner.toLowerCase() !== NEW_OWNER.toLowerCase()) {
    throw new Error(`ProxyAdmin owner is ${owner}; expected deployer or ${NEW_OWNER}`);
  }

  const groups = [
    {
      name: 'PairFactory',
      contract: pairFactory,
      roles: [
        ['PAIRS_CREATOR_ROLE', await pairFactory.PAIRS_CREATOR_ROLE(), true],
        ['PAIRS_ADMINISTRATOR_ROLE', await pairFactory.PAIRS_ADMINISTRATOR_ROLE(), true],
        ['FEES_MANAGER_ROLE', await pairFactory.FEES_MANAGER_ROLE(), true],
        ['DEFAULT_ADMIN_ROLE', await pairFactory.DEFAULT_ADMIN_ROLE(), true],
      ] as const,
    },
    {
      name: 'FeesVaultFactory',
      contract: feesVaultFactory,
      roles: [
        ['FEES_VAULT_ADMINISTRATOR_ROLE', await feesVaultFactory.FEES_VAULT_ADMINISTRATOR_ROLE(), true],
        ['CLAIM_FEES_CALLER_ROLE', await feesVaultFactory.CLAIM_FEES_CALLER_ROLE(), true],
        // we ignore this role because it is not required for the new owner to have it, only PairFactory needs it to create new pairs.
        // ['WHITELISTED_CREATOR_ROLE', await feesVaultFactory.WHITELISTED_CREATOR_ROLE(), false]
        ['DEFAULT_ADMIN_ROLE', await feesVaultFactory.DEFAULT_ADMIN_ROLE(), true],
      ] as const,
    },
    {
      name: 'LPRewarder',
      contract: rewarder,
      roles: [
        ['CLAMER_FOR_ROLE', ethers.id('CLAMER_FOR_ROLE'), false],
        ['DEFAULT_ADMIN_ROLE', await rewarder.DEFAULT_ADMIN_ROLE(), true],
      ] as const,
    },
  ];

  const transfers: RoleTransfer[] = [];
  for (const group of groups) {
    for (const [roleName, role, required] of group.roles) {
      const deployerHasRole = await group.contract.hasRole(role, deployer.address);
      const newOwnerHasRole = await group.contract.hasRole(role, NEW_OWNER);
      if (required && !deployerHasRole && !newOwnerHasRole) {
        throw new Error(`${group.name}: neither deployer nor new owner has ${roleName}`);
      }
      if (deployerHasRole) {
        const adminRole = await group.contract.getRoleAdmin(role);
        if (!(await group.contract.hasRole(adminRole, deployer.address))) {
          throw new Error(`${group.name}: deployer cannot grant or revoke ${roleName}`);
        }
      }
      if (deployerHasRole || newOwnerHasRole) {
        transfers.push({ contract: group.contract, contractName: group.name, role, roleName, deployerHasRole });
      }
    }
  }

  // Grant and verify every role before removing any deployer access.
  for (const transfer of transfers) {
    if (!(await transfer.contract.hasRole(transfer.role, NEW_OWNER))) {
      const tx = await transfer.contract.grantRole(transfer.role, NEW_OWNER);
      console.log(`${transfer.contractName}.grantRole(${transfer.roleName}, ${NEW_OWNER}): ${tx.hash}`);
      await tx.wait();
    }
    if (!(await transfer.contract.hasRole(transfer.role, NEW_OWNER))) {
      throw new Error(`${transfer.contractName}: ${NEW_OWNER} lacks ${transfer.roleName} after grant`);
    }
  }

  // DEFAULT_ADMIN_ROLE is last in each group, so the deployer retains grant/revoke authority until the other roles are removed.
  for (const transfer of transfers) {
    if (transfer.deployerHasRole && (await transfer.contract.hasRole(transfer.role, deployer.address))) {
      const tx = await transfer.contract.revokeRole(transfer.role, deployer.address);
      console.log(`${transfer.contractName}.revokeRole(${transfer.roleName}, ${deployer.address}): ${tx.hash}`);
      await tx.wait();
    }
    if (await transfer.contract.hasRole(transfer.role, deployer.address)) {
      throw new Error(`${transfer.contractName}: deployer still has ${transfer.roleName}`);
    }
  }

  if (owner.toLowerCase() === deployer.address.toLowerCase()) {
    const tx = await proxyAdmin.transferOwnership(NEW_OWNER);
    console.log(`ProxyAdmin.transferOwnership(${NEW_OWNER}): ${tx.hash}`);
    await tx.wait();
  }
  if ((await proxyAdmin.owner()).toLowerCase() !== NEW_OWNER.toLowerCase()) {
    throw new Error('ProxyAdmin ownership was not transferred');
  }
  for (const transfer of transfers) {
    if (!(await transfer.contract.hasRole(transfer.role, NEW_OWNER))) {
      throw new Error(`${transfer.contractName}: ${NEW_OWNER} lost ${transfer.roleName}`);
    }
  }

  console.log(`Elysium access and ProxyAdmin ownership transferred to ${NEW_OWNER}`);
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
