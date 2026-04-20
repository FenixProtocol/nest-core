import { ethers } from 'hardhat';
import { InstanceName } from '../../../utils/Names';

const TARGET_OWNERSHIP = '0x6652173b0Cb3d96d8f0198bc49670440Dec69e79';
const OLD_OWNERSHIP = '0xfD931508B326Fae6866aC3Dc5e288b6387dEcB06';
const DEFAULT_ADMIN_ROLE = ethers.ZeroHash;

const ADDRESSES = {
  proxyAdmin: '0xb688d5e73777DfaaDbD7c5Fe98Aee6F35CF20124',
  pairFactory: '0x889Fd0aDA8453C7619cD7f11E9029a1f0848Fdf5',
  gaugeFactoryV2: '0x15eb3987A7edC464e5A4d3bC3A9b8E84b8ceE2C7',
  gaugeFactoryV3: '0x09D1A533032319557196F87dFf831FF46204c49d',
  strategyFactory: '0x98fe2510DFcAdb52431C2A651E1ecfC46196fa87',
  bribeFactory: '0x638e382300Ee2ece790164DAfAF7a9f16045621b',
} as const;

async function main() {
  // const proxyAdmin = await ethers.getContractAt(InstanceName.ProxyAdmin, ADDRESSES.proxyAdmin);
  // const tx1 = await proxyAdmin.transferOwnership(TARGET_OWNERSHIP);
  // console.log(`ProxyAdmin: ownership transferred; tx hash: ${tx1.hash}`);

  const pairFactory = await ethers.getContractAt(InstanceName.PairFactoryUpgradeable, ADDRESSES.pairFactory);
  const tx2 = await pairFactory.revokeRole(DEFAULT_ADMIN_ROLE, OLD_OWNERSHIP);
  console.log(`PairFactoryUpgradeable: revoked DEFAULT_ADMIN_ROLE from ${OLD_OWNERSHIP}; tx hash: ${tx2.hash}`);

  const gaugeFactoryV2 = await ethers.getContractAt(InstanceName.GaugeFactoryUpgradeable, ADDRESSES.gaugeFactoryV2);
  const tx3 = await gaugeFactoryV2.transferOwnership(TARGET_OWNERSHIP);
  console.log(`GaugeFactoryUpgradeable V2: ownership transferred; tx hash: ${tx3.hash}`);

  const gaugeFactoryV3 = await ethers.getContractAt(InstanceName.GaugeFactoryUpgradeable, ADDRESSES.gaugeFactoryV3);
  const tx4 = await gaugeFactoryV3.transferOwnership(TARGET_OWNERSHIP);
  console.log(`GaugeFactoryUpgradeable V3: ownership transferred; tx hash: ${tx4.hash}`);

  const strategyFactory = await ethers.getContractAt(
    InstanceName.CompoundVeNESTManagedNFTStrategyFactoryUpgradeable,
    ADDRESSES.strategyFactory,
  );
  const tx5 = await strategyFactory.revokeRole(DEFAULT_ADMIN_ROLE, OLD_OWNERSHIP);
  console.log(`CompoundVeNESTManagedNFTStrategyFactoryUpgradeable: revoked DEFAULT_ADMIN_ROLE from ${OLD_OWNERSHIP}; tx hash: ${tx5.hash}`);

  const bribeFactory = await ethers.getContractAt(InstanceName.BribeFactoryUpgradeable, ADDRESSES.bribeFactory);
  const tx6 = await bribeFactory.transferOwnership(TARGET_OWNERSHIP);
  console.log(`BribeFactoryUpgradeable: ownership transferred; tx hash: ${tx6.hash}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
