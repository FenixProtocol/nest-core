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
  //await logTx(Distributor, Distributor.setWhitelistReasons([reason], [true]));

  if(Distributor.target == "0x22350F14c6ee70992f1bbc7498e4C291B8B7682f") {
    await logTx(Nest, Nest.transfer(Distributor, ethers.parseEther('35625000')));
  }

  type Row = {
    address: string;
    amount: bigint;
  };
  
  const investorsRaw: Row[] = [
    {
      address: "0x9C36aD788d397451034B2427e7A9cE8Ab93B2B27",
      amount: ethers.parseEther('750000')
    },
    {
      address: "0x0B1546556d5C77F9f62594D1e9790Ef2bF56Ca74",
      amount: ethers.parseEther('2500000')
    },
    {
      address: "0xb581eBC49942cf88E824dc3F3645dE5D86961f62",
      amount: ethers.parseEther('2500000')
    },
    {
      address: "0xd791427e372186E90637caF1D6D6AFb054BeeC7A",
      amount: ethers.parseEther('1500000')
    },
    {
      address: "0xf9bbE785C7868F971beC9c02d1E4961A8567000a",
      amount: ethers.parseEther('2500000')
    },
    {
      address: "0x26BD0E4D3571cf4aa2533Cce3A7D3FF75269b70d",
      amount: ethers.parseEther('1250000')
    },
    {
      address: "0x91097504c1ca1Ffa06798A16a31b1702d76f798f",
      amount: ethers.parseEther('500000')
    },
    {
      address: "0x28197a31B0154433c62ed408D4C03a0a65076b8f",
      amount: ethers.parseEther('1000000')
    },
    {
      address: "0x6D7823CD5c3d9dcd63E6A8021b475e0c7C94b291",
      amount: ethers.parseEther('5000000')
    },
    {
      address: "0x97046772d3c93717285215dfaa8fa4f93866cae2",
      amount: ethers.parseEther('750000')
    },
    {
      address: "0x0dEf0BaCf09a27E0836EF3096F9c3AE859aC13eA",
      amount: ethers.parseEther('375000')
    },
    {
      address: "0x20990bE7DA637730EA249096390BdC19e8AB63c7",
      amount: ethers.parseEther('500000')
    },
    {
      address: "0xaA63b6c5383781d7Ae6BbC4dE1346061dc5740D5",
      amount: ethers.parseEther('500000')
    },
    {
      address: "0x649f69ccd077da03dfb11f4b1daab4b625f5e9a3",
      amount: ethers.parseEther('2500000')
    },
    {
      address: "0x5d4d3fae4d0282fd8a558b5f42ba700974cbfd1a",
      amount: ethers.parseEther('500000')
    },
    {
      address: "0x1cdc8E5E9bf446137c035a702090D9768D46e802",
      amount: ethers.parseEther('500000')
    },
    {
      address: "0x129B027960B6D15B2C235FC04ac17caAA1d910E0",
      amount: ethers.parseEther('2500000')
    },
    {
      address: "0xeF43CdC09F3017e4C3Cb57DC321D14729F6010C9",
      amount: ethers.parseEther('1250000')
    },
    {
      address: "0x7F00dd791fEEb1CE749BAeC334873f5A78a9C6c8",
      amount: ethers.parseEther('750000')
    },
    {
      address: "0xa7841d986304abd5ce9Ab3Ba6B5c06290A0c6ff9",
      amount: ethers.parseEther('1000000')
    },
    {
      address: "0x5F363952aFF350Fc994b6535370F94FB47db3D09",
      amount: ethers.parseEther('1250000')
    },
    {
      address: "0xf88AE7850484Dc8C6cB56A32e351D8e4002A53b9",
      amount: ethers.parseEther('2500000')
    },
    {
      address: "0x68C2c7dFbbE886017b60402424a5f6B2Dd20eA37",
      amount: ethers.parseEther('750000')
    },
    {
      address: "0x18709337A2C6a460550B4B1b98BcaEd8ea368842",
      amount: ethers.parseEther('2500000')
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
