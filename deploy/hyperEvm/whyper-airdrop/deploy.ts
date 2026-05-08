import { ethers } from 'hardhat';
import { InstanceName } from '../../../utils/Names';
import {
    AliasDeployedContracts,
    deploy,
    deployProxy,
    getDeployedContractsAddressList,
    logTx,
} from '../../../utils/Deploy';

const WHYPE_AIRDROP_IMPLEMENTATION_ALIAS = 'WHypeAirdrop_Implementation';
const WHYPE_AIRDROP_PROXY_ALIAS = 'WHypeAirdrop_Proxy';
const DEFAULT_WHYPE_ADDRESS = '0x5555555555555555555555555555555555555555';
const ROLE_RECIPIENT = '0x5339E2BB6d07bc0E82D56E99FA669256c9596A4F';

async function main() {
    const [deployer] = await ethers.getSigners();

    const whypeAddress = DEFAULT_WHYPE_ADDRESS;
    const roleRecipient = ROLE_RECIPIENT;

    if (!ethers.isAddress(whypeAddress)) {
        throw new Error(`Invalid WHYPE_ADDRESS: ${whypeAddress}`);
    }

    if (!ethers.isAddress(roleRecipient)) {
        throw new Error(`Invalid WHYPER_AIRDROP_ROLE_HOLDER: ${roleRecipient}`);
    }

    const deployedContracts = await getDeployedContractsAddressList();
    const proxyAdmin = deployedContracts[AliasDeployedContracts.ProxyAdmin];

    if (!proxyAdmin || !ethers.isAddress(proxyAdmin)) {
        throw new Error('ProxyAdmin is missing or invalid in deployments file.');
    }

    const airdropFactory = await ethers.getContractFactory('WHypeAirdrop');
    const implementation = await deploy({
        deployer,
        name: InstanceName.WHypeAirdrop,
        constructorArguments: [],
        saveAlias: WHYPE_AIRDROP_IMPLEMENTATION_ALIAS,
        verify: true,
    });
    const implementationAddress = await implementation.getAddress();
    const initializeCalldata = airdropFactory.interface.encodeFunctionData('initialize', [whypeAddress]);
    const proxy = await deployProxy({
        deployer,
        logic: implementationAddress,
        admin: proxyAdmin,
        data: initializeCalldata,
        saveAlias: WHYPE_AIRDROP_PROXY_ALIAS,
        verify: true,
    });

    const proxyAddress = await proxy.getAddress();
    const whypeAirdropProxy = await ethers.getContractAt('WHypeAirdrop', proxyAddress);

    await logTx(
        whypeAirdropProxy,
        whypeAirdropProxy.grantRole(await whypeAirdropProxy.DEFAULT_ADMIN_ROLE(), roleRecipient),
    );
    await logTx(
        whypeAirdropProxy,
        whypeAirdropProxy.grantRole(await whypeAirdropProxy.ROOT_SETTER_ROLE(), roleRecipient),
    );

    console.log(`WHypeAirdrop implementation: ${implementationAddress}`);
    console.log(`WHypeAirdrop proxy: ${proxyAddress}`);
    console.log(`WHYPE token: ${whypeAddress}`);
    console.log(`Roles granted to: ${roleRecipient}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
