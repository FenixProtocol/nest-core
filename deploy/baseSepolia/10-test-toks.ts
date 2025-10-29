import {
  AliasDeployedContracts,
  deploy,
  deployProxy,
  getDeployedContractsAddressList,
  getProxyAdminAddress,
  logTx,
} from '../../utils/Deploy';
import { ethers } from 'hardhat';
import { InstanceName } from '../../utils/Names';
import { GetInformationAddressKey } from '../../utils/Constants';
import { ART_RPOXY_PARTS } from '../../utils/ArtProxy';

const MAX_POOLS_PER_VOTE = 4; // "декілька" — до 4; змінюй за потреби
const PROB_ONE_POOL = 0.7; // 70% шанс голосувати в 1 пул
const TOTAL_WEIGHT_BPS = 10_000; // сума ваг у базисних пунктах

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomPartition(total: number, parts: number): number[] {
  if (parts === 1) return [total];
  // випадкові "розрізи" 1..total-1
  const cuts = new Set<number>();
  while (cuts.size < parts - 1) cuts.add(randInt(1, total - 1));
  const points = [0, ...Array.from(cuts).sort((a, b) => a - b), total];
  const chunks: number[] = [];
  for (let i = 1; i < points.length; i++) chunks.push(points[i] - points[i - 1]);
  return chunks;
}
function randomWeightsBps(parts: number, total = TOTAL_WEIGHT_BPS): bigint[] {
  if (parts === 1) return [BigInt(total)];
  // мінімум 1 бп на кожен
  const minEach = 1;
  const remaining = total - parts * minEach;
  // зробимо один пул домінуючим: забере щонайменше 50% total
  const dominant = randInt(Math.floor(total * 0.5), Math.floor(total * 0.8));
  const restTotal = total - dominant - (parts - 1) * minEach;

  // розкидаємо решту випадково між (parts-1)
  const rest = restTotal > 0 ? randomPartition(restTotal, parts - 1) : Array(parts - 1).fill(0);

  // збираємо: [домінуючий, інші] + додаємо мінімум
  const weights = [dominant, ...rest.map((x) => x + minEach)];
  // перемішати, щоб домінуючий не завжди був першим
  for (let i = weights.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    [weights[i], weights[j]] = [weights[j], weights[i]];
  }
  return weights.map((w) => BigInt(w));
}

function sampleUnique<T>(arr: T[], k: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, k);
}

function chooseK(maxK: number): number {
  if (maxK <= 1) return 1;
  return Math.random() < PROB_ONE_POOL ? 1 : randInt(2, maxK);
}

async function main() {
  const [deployer] = await ethers.getSigners();

  const DeployedContracts = await getDeployedContractsAddressList();

  const VotingEscrowUpgradeable = await ethers.getContractAt(
    InstanceName.VotingEscrowUpgradeable,
    DeployedContracts[AliasDeployedContracts.VotingEscrowUpgradeable_Proxy],
  );
  const Voter = await ethers.getContractAt(InstanceName.VoterUpgradeable, DeployedContracts[AliasDeployedContracts.VoterUpgradeable_Proxy]);

  await Voter.distributeAll();

  // let count = await VotingEscrowUpgradeable.balanceOf(deployer);
  // let poolsCount = await Voter.poolsCounts();
  // let pools = [];

  // for (let index = 0; index < poolsCount.totalCount; index++) {
  //   pools.push(await Voter.pools(index));
  // }
  // console.log(`pools count`, poolsCount);
  // console.log(`tokensCount`, count);
  // console.log(`deployer`, deployer);

  // for (let index = 0; index < count; index++) {
  //   const tokenId = await VotingEscrowUpgradeable.tokenOfOwnerByIndex(deployer, index);
  //   console.log(`tokenId`, tokenId);

  //   let state = await VotingEscrowUpgradeable.nftStates(tokenId);

  //   const maxK = Math.min(MAX_POOLS_PER_VOTE, pools.length);
  //   const k = chooseK(maxK);
  //   const chosenPools = sampleUnique(pools, k);
  //   const weights = randomWeightsBps(k); // сумарно 10000 бп

  //   if (state.locked.end < 1756986797 && !state.locked.isPermanentLocked) {
  //     console.log(`tokenId=${tokenId} expired.`);
  //   } else if (!state.isAttached) {
  //     console.log(`Голосую tokenId=${tokenId} по ${k} пул(ах):`, chosenPools.map((a, idx) => `${a}:${weights[idx].toString()}`).join(', '));

  //     let tx = await Voter.vote(tokenId, chosenPools, weights);
  //     await tx.wait();
  //   } else {
  //     console.log(`tokenId=${tokenId} вже прикріплено — пропускаю.`);
  //   }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
