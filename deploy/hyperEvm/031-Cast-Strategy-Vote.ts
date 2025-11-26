import { ethers } from 'hardhat';
import { AliasDeployedContracts, getDeployedContractsAddressList, logTx } from '../../utils/Deploy';
import { InstanceName } from '../../utils/Names';
import Snapshot from "./025-public-raise/raw_output.json";

async function main() {
  const DeployedContracts = await getDeployedContractsAddressList();

  const Strategy = await ethers.getContractAt(
    InstanceName.CompoundVeNESTManagedNFTStrategyUpgradeable,
    "0x96F7b8BA7580d3E510B0Fb3F0E135a743d8eb17a",
  );
  let poolsToVote = [
      "0x45fbf9786cdbde9e940620f4af0eb42b76848d17",
      "0xce17208bda21f2d84e1a410f8704ac56038a179d",
      "0xcd238eafadb112515910f8d09d94a90ac8c180fe",
      "0xc0578d20762fd5f4ba6f09124993709ffaa029ab",
      "0xa83d60b1a9ca6dd1d0d2d9275c700114f2f3a8d6",
      "0x395dd0eb1843f92f23d94828d01f46c679949e61",
      "0x20e6e73c91a29d21bde672562a4b16649d66623e",
      "0x9aa281b23341ce69d4b1500367a43cfc42005538",
      "0x998007a512531d9081e116f85605c40d41abd4f1",
      "0xb09a299e9f7d333420d347eebe0456cb0f8545d5",
      "0xc08fec05f656690e2658ef8082f909e8d6edc727"
  ]
  let votesData = [
      19248141,
      641605,
      5774442,
      641605,
      1283209,
      12832094,
      8340861,
      7057652,
      3849628,
      3208023,
      1283209
    ];
  let sum = 0;

  votesData.forEach(t => {
    sum += t;
  })
  
  votesData.forEach(t => {
    console.log(t , t/sum);
  })    
  console.log("sum", sum)
  await logTx(Strategy, Strategy.vote(
    poolsToVote,
    votesData
  ));

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
