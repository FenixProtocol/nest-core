import { ethers } from 'hardhat';

const ADDRESS = '0x566bdc5444fd5fe5d93ec379Bd66eC861ddbA901';
const FROM_SLOT = 0;
const TO_SLOT = 500;

async function main() {
  console.log(`Reading storage slots [${FROM_SLOT}..${TO_SLOT}] for contract ${ADDRESS}\n`);
  console.log(`${'Slot'.padEnd(6)} | ${'Hex Slot'.padEnd(66)} | Value`);
  console.log('-'.repeat(145));

  for (let i = FROM_SLOT; i <= TO_SLOT; i++) {
    const slot = ethers.toBeHex(i, 32);
    const value = await ethers.provider.getStorage(ADDRESS, slot);
    const isNonZero = BigInt(value) !== 0n;
    const marker = isNonZero ? ' *' : '';
    console.log(`${String(i).padEnd(6)} | ${slot} | ${value}${marker}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
