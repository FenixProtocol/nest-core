import { ethers } from "hardhat";
import { AliasDeployedContracts, getDeployedContractsAddressList } from "../../utils/Deploy";

async function getNftStateIfExists(
  ve: any,
  tokenId: any,
  blockTag: number
): Promise<any | undefined> {
  if (blockTag <= 0) return undefined;

  try {
    let owner = await ve.ownerOf(tokenId, { blockTag });
    if(owner == ethers.ZeroAddress) {
      return undefined;
    }
  } catch {
    return undefined;
  }

  return ve.getNftState(tokenId, { blockTag });
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const deployed = await getDeployedContractsAddressList();

  const ve = await ethers.getContractAt(
    "VotingEscrowUpgradeableV2",
    deployed[AliasDeployedContracts.VotingEscrowUpgradeable_Proxy],
    deployer
  );

  const FROM_BLOCK = 17863474;
  const BLOCK_STEP = 10000;

  const latestBlock = await ethers.provider.getBlockNumber();
  console.log(
    `Scanning Merge events from ${FROM_BLOCK} to ${latestBlock} in chunks of ${BLOCK_STEP} blocks`
  );
  
  const mergeFilter = ve.filters.Merge();

  for (let fromBlock = FROM_BLOCK; fromBlock <= latestBlock; fromBlock += BLOCK_STEP) {
    const toBlock = Math.min(fromBlock + BLOCK_STEP - 1, latestBlock);

    console.log(`\n=== Range [${fromBlock}, ${toBlock}] ===`);
    const events = await ve.queryFilter(mergeFilter, fromBlock, toBlock);
    console.log(`Found ${events.length} Merge events in this range`);

    for (const ev of events) {
      const blockNumber = ev.blockNumber;
      const txHash = ev.transactionHash;

      const tokenFromId = ev.args.tokenIdFrom
      const tokenToId = ev.args.tokenIdTo

      const blockBefore = blockNumber - 1;

      const fromStateBefore = await getNftStateIfExists(ve, tokenFromId, blockBefore);
      const toStateBefore = await getNftStateIfExists(ve, tokenToId, blockBefore);

      const toStateAfter = await getNftStateIfExists(ve, tokenToId, blockNumber + 1);

      const fromEndBefore = fromStateBefore.locked.end;
      const toEndBefore = toStateBefore.locked.end;
      const toEndAfter = toStateAfter.locked.end;

      console.log(`Tx: ${txHash}`);
      console.log(`  block: ${blockNumber}`);
      console.log(
        `  tokenFromId: ${tokenFromId.toString()}, tokenToId: ${tokenToId.toString()}`
      );
      console.log(`  fromEndBefore: ${fromEndBefore.toString()}`);
      console.log(`  toEndBefore:   ${toEndBefore.toString()}`);
      console.log(`  toEndAfter:    ${toEndAfter.toString()}`);

      const expectedMinEnd = Math.max(
        Number(fromEndBefore.toString()),
        Number(toEndBefore.toString())
      );

      console.log(`  expectedMinEnd:    ${expectedMinEnd.toString()}`);
      console.log(`  finalEnd:    ${toEndAfter.toString()}`);

      let invariantHolds =
        Number(toEndAfter.toString()) === 0 ||
        Number(toEndAfter.toString()) >= expectedMinEnd;
      
      invariantHolds = !invariantHolds ? false :  Number(toEndAfter.toString()) !== 0 || toStateAfter.locked.isPermanentLocked
      console.log(
        `  invariant toEndAfter >= max(fromEndBefore, toEndBefore) OR permanent: ${invariantHolds}`
      );
    }
  }

}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
