import { ethers } from 'hardhat';
import { AliasDeployedContracts, deploy, getDeployedContractsAddressList, getProxyAdminAddress, logTx } from '../../utils/Deploy';
import { InstanceName } from '../../utils/Names';

async function main() {
  const DeployedContracts = await getDeployedContractsAddressList();

  let BribeFactoryUpgradeable = await ethers.getContractAt(InstanceName.BribeFactoryUpgradeable, DeployedContracts[AliasDeployedContracts.BribeFactoryUpgradeable_Proxy]);

  let NEST = "0x07c57E32a3C29D5659bda1d3EFC2E7BF004E3035" // already added
  let WHYPE = "0x5555555555555555555555555555555555555555";
  let kHYPE = "0xfD739d4e423301CE9385c1fb8850539D657C296D";
  let UETH = "0xBe6727B535545C67d5cAa73dEa54865B92CF7907";
  let UBTC = "0x9FDBdA0A5e284c32744D2f17Ee5c74B284993463";
  let USOL = "0x068f321Fa8Fb9f0D135f290Ef6a3e2813e1c8A29";
  let UPUMP = "0x27eC642013bcB3D80CA3706599D3cdA04F6f4452"
  let USDT0 = "0xb8ce59fc3717ada4c02eadf9682a9e934f625ebb";
  let USDC = "0xb88339CB7199b77E23DB6E890353E22632Ba630f";
  let USDH = "0x111111a1a0667d36bD57c0A9f569b98057111111";
  let UXPL = "0x33Af3c2540Ba72054e044EFe504867B39aE421f5";
  let PURR = "0x9b498C3c8A0b8CD8BA1D9851d40D186F1872b44E";
  let feUSD = "0x02c6a2fA58cC01A18B8D9E00eA48d65E4dF26c70";
  let USDe = "0x5d3a1Ff2b6BAb83b63cd9AD0787074081a52ef34";

  const tokens: string[] = [
    NEST,
    WHYPE,
    kHYPE,
    UETH,
    UBTC,
    USOL,
    UPUMP,
    USDT0,
    USDC,
    USDH,
    UXPL,
    PURR,
    feUSD,
    USDe,
  ];

  for await (const token of tokens) {
    let tokenTyped  = await ethers.getContractAt("ERC20", token);
    console.log("Try add", await tokenTyped.name(), await tokenTyped.decimals());
    if(!(await BribeFactoryUpgradeable.isDefaultRewardToken(token))) {
      await logTx(BribeFactoryUpgradeable, BribeFactoryUpgradeable.pushDefaultRewardToken(token));
    }
  }

  console.log(
    'Default rewards tokens list:',
    await BribeFactoryUpgradeable.getDefaultRewardTokens()
  );

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
