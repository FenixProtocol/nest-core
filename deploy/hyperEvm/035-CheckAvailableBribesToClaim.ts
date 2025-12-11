import { ethers } from "hardhat";
import { AliasDeployedContracts, getDeployedContractsAddressList } from "../../utils/Deploy";
import { addCliParams } from "hardhat-tracer";

async function main() {
  const [deployer] = await ethers.getSigners();
  const deployed = await getDeployedContractsAddressList();

  const Voter = await ethers.getContractAt("VoterUpgradeableV2", deployed[AliasDeployedContracts.VoterUpgradeable_Proxy]);

  let countStruct = await Voter.poolsCounts();
  let allPoolCount = countStruct.totalCount;

  let data = [];
  for (let index = 0; index < allPoolCount; index++) {
    let poolAddress = await Voter.pools(index);
    let gaugeAddress = await Voter.poolToGauge(poolAddress);
    let gaugeState = await Voter.gaugesState(gaugeAddress);
    data.push(gaugeState.internalBribe);
    data.push(gaugeState.externalBribe);
  }

  let targetOwner  = "0x96F7b8BA7580d3E510B0Fb3F0E135a743d8eb17a"
  let targetEpoch = 1764806400;
  console.log("epoch:", targetEpoch);
  for await (const info of data) {
    let bribe = await ethers.getContractAt("BribeUpgradeable", info);
    let rewardTokens = await bribe.getRewardTokens();
    let alreadyMsg = false;
    let rewardTokensUniquie = [...new Set(rewardTokens)];
    for await (const rewardToken of rewardTokensUniquie) {
       let amount = await bribe["earned(address,address)"](targetOwner, rewardToken);
       if(amount > 0n) {
        if(!alreadyMsg) {
          alreadyMsg = true;
          console.log(`Found rewards in ${bribe.target}`)
        }
        let token = await ethers.getContractAt("ERC20", rewardToken);
        let symbol = await token.symbol();
        let decimals = await token.decimals();
        console.log(`\t${rewardToken} ${symbol} ${amount} ${ethers.formatUnits(amount, decimals)}`);
       }
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
