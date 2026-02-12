import { ethers } from 'hardhat';
import { AliasDeployedContracts, InstanceName } from '../../../utils/Names';
import { deploy } from '../../../utils/Deploy';

const DEPLOYER = "0xfD931508B326Fae6866aC3Dc5e288b6387dEcB06";
const PROXY_ADMIN_ADDRESS = "0xb688d5e73777DfaaDbD7c5Fe98Aee6F35CF20124";
const VOTER_PROXY_ADDRESS = "0x566bdc5444fd5fe5d93ec379Bd66eC861ddbA901";
const GAUGES_ARRAY = ["0x361100b14e679a94E9d919C4852b178670C3CEee", "0x6bb8bd7E8C1447fB9F3e77D580D96fAC753D9dBB"];
const EXP_INDEX = 1;
const EXP_LAST_DISTRIBUTION_TIMESTAMP = 1739289600;

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deployer address:", deployer.address);
    if (deployer.address !== DEPLOYER) {
        throw new Error("Deployer address is not correct");
    }
    const voterProxy = await ethers.getContractAt(InstanceName.VoterUpgradeable, VOTER_PROXY_ADDRESS);
    const currentIndex = await voterProxy.index();
    console.log("Current index:", currentIndex);
    const proxyAdmin = await ethers.getContractAt(InstanceName.ProxyAdmin, PROXY_ADMIN_ADDRESS);
    if (await proxyAdmin.owner() !== deployer.address) {
        throw new Error("Proxy admin is not correct");
    }
    // deploying new voter implementation
    const newVoterImplementation = await deploy({
        name: InstanceName.VoterUpgradeable,
        deployer: deployer,
        constructorArguments: [],
        saveAlias: AliasDeployedContracts.VoterUpgradeable_Implementation,
        verify: true,
    });
    const calldata = await newVoterImplementation.interface.encodeFunctionData("reinitialize", [GAUGES_ARRAY, [EXP_INDEX, EXP_INDEX], [EXP_LAST_DISTRIBUTION_TIMESTAMP, EXP_LAST_DISTRIBUTION_TIMESTAMP]]);
    await proxyAdmin.upgradeAndCall(VOTER_PROXY_ADDRESS, newVoterImplementation.target, calldata);
}
function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
