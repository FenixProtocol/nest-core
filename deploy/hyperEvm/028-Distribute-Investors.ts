import { ethers } from 'hardhat';
import { AliasDeployedContracts, getDeployedContractsAddressList, logTx } from '../../utils/Deploy';
import { InstanceName } from '../../utils/Names';
import Snapshot from "./025-public-raise/raw_output.json";

async function main() {
  const DeployedContracts = await getDeployedContractsAddressList();

  const Nest = await ethers.getContractAt(
    InstanceName.Nest,
    DeployedContracts[AliasDeployedContracts.Nest],
  );


  const Distributor = await ethers.getContractAt(
    InstanceName.VeNestDistributorUpgradeable,
    DeployedContracts[AliasDeployedContracts.VeNestDistributorUpgradeable_Proxy]
  )

  let reason = "Investors";

  // if(Distributor.target == "0x22350F14c6ee70992f1bbc7498e4C291B8B7682f") {
  //   await logTx(Nest, Nest.transfer(Distributor, ethers.parseEther('2750000')));
  // }

  type Row = {
    address: string;
    amount: bigint;
  };
  
  const investorsRaw: Row[] = [
    {
      address: "0x19024c69c0c46aA89e36b97876Dc727b8Fed997b",
      amount: ethers.parseEther('1000000')
    },
    {
      address: "0xf0BD6d33Db49D7e3Ae924C72FAD9efDc4d5AEE54",
      amount: ethers.parseEther('1250000')
    },
    {
      address: "0xdc35A1bBB14c944430Ab6Cf21c3075417535fAb8",
      amount: ethers.parseEther('500000')
    }
  ];

  const lockDuration = 15724800;
  const managedTokenIdForAttach = 1;
  const withPermanentLock = true;

  const rows = investorsRaw.map((row) => ({
      recipient: row.address,
      withPermanentLock,
      lockDuration,
      amount: BigInt(row.amount),
      managedTokenIdForAttach: managedTokenIdForAttach
  }));

  let sum = 0n;
  rows.forEach(t => {
    sum += t.amount;
  })

  console.log("sum", sum)
  await logTx(
      Distributor,
      Distributor.distributeVeNest(reason, rows)
  );
  console.log("Done: investors veNEST distribution.");

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
