import { ethers } from 'hardhat';
import { AliasDeployedContracts, deploy } from '../../../utils/Deploy';
import { InstanceName } from '../../../utils/Names';

async function main() {
    const [deployer] = await ethers.getSigners();
    const pairFactoryAddress = "0x889Fd0aDA8453C7619cD7f11E9029a1f0848Fdf5";
    const wETHAddress = "0x5555555555555555555555555555555555555555";
    await deploy({
        name: InstanceName.RouterV2,
        deployer,
        constructorArguments: [pairFactoryAddress, wETHAddress],
        saveAlias: AliasDeployedContracts.RouterV2,
        verify: true,
    });

    console.log('\nRouterV2 deployed\n');
}
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
