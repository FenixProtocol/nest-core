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

  if(Distributor.target == "0x22350F14c6ee70992f1bbc7498e4C291B8B7682f") {
    await logTx(Nest, Nest.transfer(Distributor, ethers.parseEther('7719500')));
  }

  type Row = {
    address: string;
    amount: bigint;
  };
  
  const investorsRaw: Row[] = [
    {
      address: "0xB39264CE41907A61ED25a59101F696927A1dDa2F",
      amount: ethers.parseEther('500000')
    },
    {
      address: "0xb7Be9cC0Edbd63237A59280e118a2554a13FB2fE",
      amount: ethers.parseEther('769000')
    },
    {
      address: "0xfd944C5B30856e7B972200306aa65Fcce7Ec1f00",
      amount: ethers.parseEther('169000')
    },
    {
      address: "0xAa97eb94013EE53C47b338CdD7dce52d82210a95",
      amount: ethers.parseEther('750000')
    },
    {
      address: "0x03dc2d9a642fb882507405d25754f9704e4a38fd",
      amount: ethers.parseEther('12500')
    },
    {
      address: "0x71aa99866669a41ad0d4c2ce089fd4123ad8d316",
      amount: ethers.parseEther('2100000')
    },
    {
      address: "0x013970b99267F6f6acfe52948B1A22973A976BD5",
      amount: ethers.parseEther('3000000')
    },
    {
      address: "0x03d52cb84d90773c280ad77af95ac55807c94790",
      amount: ethers.parseEther('250000')
    },
    {
      address: "0xf1C9AdC4026EEa65dF1ca3468be1cC27DC560e7C",
      amount: ethers.parseEther('169000')
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
