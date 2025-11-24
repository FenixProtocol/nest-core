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

  let reason = "Public Raise";
  await logTx(Distributor, Distributor.setWhitelistReasons([reason], [true]));

  if(Distributor.target == "0x22350F14c6ee70992f1bbc7498e4C291B8B7682f") {
    await logTx(Nest, Nest.transfer(Distributor, 7406250000000000000000000n));
  }

  type SnapshotRow = {
    address: string;
    amount: string;
  };
  
  const snapshot: SnapshotRow[] = Snapshot as unknown as SnapshotRow[];

  const CHUNK_SIZE = 20;
  const lockDuration = 15724800;
  const managedTokenIdForAttach = 1;
  const withPermanentLock = true;
  console.log(`Total recipients in snapshot: ${snapshot.length}`);
  
  for (let i = 0; i < snapshot.length; i += CHUNK_SIZE) {
    const slice = snapshot.slice(i, i + CHUNK_SIZE);

    const rows = slice.map((row) => ({
      recipient: row.address,
      withPermanentLock,
      lockDuration,
      amount: BigInt(row.amount),
      managedTokenIdForAttach,
    }));

    console.log(
      `Sending batch ${i / CHUNK_SIZE + 1}: ${slice.length} recipients`
    );

    console.log("rows", rows)
    await logTx(
      Distributor,
      Distributor.distributeVeNest(reason, rows)
    );
  }
  console.log("Done: public raise veNEST distribution.");

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
