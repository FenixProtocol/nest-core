import { ethers } from 'hardhat';

const VOTER_PROXY = '0x566bdc5444fd5fe5d93ec379Bd66eC861ddbA901';

// const TARGET_DATES: { label: string; timestamp: number }[] = [
//   { label: '2026-03-16 00:00 UTC', timestamp: Date.UTC(2026, 2, 16) / 1000 },
//   { label: '2026-03-18 00:00 UTC', timestamp: Date.UTC(2026, 2, 18) / 1000 },
// ];

// async function findBlockByTimestamp(provider: any, targetTs: number): Promise<number> {
//   const latest = await provider.getBlock('latest');
//   if (!latest) throw new Error('Cannot fetch latest block');

//   let lo = 1;
//   let hi = latest.number;

//   while (lo < hi) {
//     const mid = Math.floor((lo + hi) / 2);
//     const block = await provider.getBlock(mid);
//     if (!block) {
//       lo = mid + 1;
//       continue;
//     }
//     if (block.timestamp < targetTs) {
//       lo = mid + 1;
//     } else {
//       hi = mid;
//     }
//   }
//   return lo;
// }

async function main() {
  const provider = ethers.provider;
  const voter = await ethers.getContractAt('VoterUpgradeableV2', VOTER_PROXY);

  const currentIndex = await voter.index();
  const latest = await provider.getBlock('latest');
  console.log(`Current index: ${ethers.formatEther(currentIndex)}`);
  const blockNumber = 30117730 - 1;
  const block = await provider.getBlock(blockNumber);
  console.log(`Block: ${blockNumber} (${new Date(block!.timestamp * 1000).toISOString()})`);
  const historicalIndex = await voter.index({ blockTag: blockNumber });
  console.log(`Historical index: ${historicalIndex}`);
  // for (const { label, timestamp } of TARGET_DATES) {
  //   console.log(`--- ${label} (unix ${timestamp}) ---`);
  //   console.log('Searching for closest block...');

  //   const blockNumber = await findBlockByTimestamp(provider, timestamp);
  //   const block = await provider.getBlock(blockNumber);
  //   console.log(`Block: ${blockNumber} (${new Date(block!.timestamp * 1000).toISOString()})`);

  //   const historicalIndex = await voter.index({ blockTag: blockNumber });
  //   console.log(`index: ${historicalIndex}`);
  //   console.log();
  // }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
