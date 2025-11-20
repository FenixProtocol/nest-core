import { ethers } from 'hardhat';
import { AliasDeployedContracts, getDeployedContractsAddressList, logTx } from '../../utils/Deploy';
import { InstanceName } from '../../utils/Names';

async function main() {
  const DeployedContracts = await getDeployedContractsAddressList();

  const Nest = await ethers.getContractAt(
    InstanceName.Nest,
    DeployedContracts[AliasDeployedContracts.Nest],
  );

  let Liquidity = "0xdB180c83029577A1Cb323542EC796Fa4cC7b8F51";
  await logTx(Nest, Nest.transfer(Liquidity, ethers.parseEther('50000000')));

  let GrowthTreasury = "0xB59cd99f88cACc73adA8D7701197B1B3a7B9c6eC";
  await logTx(Nest, Nest.transfer(GrowthTreasury, ethers.parseEther('100000000')));


  const Distributor = await ethers.getContractAt(
    InstanceName.VeNestDistributorUpgradeable,
    DeployedContracts[AliasDeployedContracts.VeNestDistributorUpgradeable_Proxy]
  )

  let reason = "Initial Tokenomics Distribution";
  await logTx(Distributor, Distributor.setWhitelistReasons([reason], [true]));

  if(Distributor.target == "0x22350F14c6ee70992f1bbc7498e4C291B8B7682f") {
    await logTx(Nest, Nest.transfer(Distributor, 750000000000000000000000000n - 750000000n));
  }
  let rows = [
    {
      recipient: "0xbA6f01324F61aD4F5997C44580CF21A80655B969", // HYPE Engine NFT
      withPermanentLock: true,
      lockDuration: 15724800,
      amount: ethers.parseEther("400000000"),
      managedTokenIdForAttach: 0
     },
    {
      recipient: "0x90D39920c60953A96BfAAFbA55F909697F55a7cC", // Team veNEST
      withPermanentLock: true,
      lockDuration: 15724800,
      amount: ethers.parseEther("150000000"),
      managedTokenIdForAttach: 0
     },
    {
      recipient: "0x8CE4d7F93f8A55E6d120F302C0BcCE502B640827", // Ecosystem Fund
      withPermanentLock: true,
      lockDuration: 15724800,
      amount: ethers.parseEther("100000000"),
      managedTokenIdForAttach: 0
     },
    {
      recipient: "0x0Ccd34Be3C5F4f905308B0eF898E870Fb7930354", // Assistance Fund
      withPermanentLock: true,
      lockDuration: 15724800,
      amount: ethers.parseEther("100000000"),
      managedTokenIdForAttach: 0
     },
  ];
  await logTx(Distributor, Distributor.distributeVeNest(reason, rows));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
