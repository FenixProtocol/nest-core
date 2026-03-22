import { ethers } from 'hardhat';

const VOTER_PROXY = '0x566bdc5444fd5fe5d93ec379Bd66eC861ddbA901';
const TARGET_TX_COUNT = 10;
const BLOCK_RANGE_PER_QUERY = 10_000;

async function main() {
  const provider = ethers.provider;
  const voter = await ethers.getContractAt('VoterUpgradeableV2', VOTER_PROXY);

  const latest = await provider.getBlock('latest');
  if (!latest) throw new Error('Cannot fetch latest block');

  console.log(`Searching for ${TARGET_TX_COUNT} NotifyReward events on Voter (${VOTER_PROXY})...`);
  console.log(`Latest block: ${latest.number}\n`);

  const notifyRewardFilter = voter.filters.NotifyReward();
  const txHashes: string[] = [];
  let toBlock = latest.number;

  while (txHashes.length < TARGET_TX_COUNT && toBlock > 0) {
    const fromBlock = Math.max(toBlock - BLOCK_RANGE_PER_QUERY + 1, 0);
    console.log(`Querying blocks ${fromBlock} – ${toBlock}...`);

    const events = await voter.queryFilter(notifyRewardFilter, fromBlock, toBlock);

    for (const event of events.reverse()) {
      if (txHashes.length >= TARGET_TX_COUNT) break;
      if (!txHashes.includes(event.transactionHash)) {
        txHashes.push(event.transactionHash);
      }
    }

    toBlock = fromBlock - BLOCK_RANGE_PER_QUERY;
  }

  console.log(`\nFound ${txHashes.length} transaction(s) with NotifyReward events:\n`);

  for (let i = 0; i < txHashes.length; i++) {
    const receipt = await provider.getTransactionReceipt(txHashes[i]);
    if (!receipt) continue;

    const block = await provider.getBlock(receipt.blockNumber);
    const timestamp = block ? new Date(block.timestamp * 1000).toISOString() : 'unknown';

    console.log(`${i + 1}. TX: ${txHashes[i]}`);
    console.log(`   Block: ${receipt.blockNumber} | ${timestamp}`);
    console.log(`   From:  ${receipt.from}`);
    console.log();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
