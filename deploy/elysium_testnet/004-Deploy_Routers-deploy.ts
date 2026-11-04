import { AliasDeployedContracts, deploy, getDeployedContractsAddressList, saveToDeployedContractsAddressList } from '../../utils/Deploy';
import { InstanceName } from '../../utils/Names';
import { assertAddressEquals, getDeploymentContext, requireDeploymentAddress } from './_shared';

async function main() {
  const { deployer, wrappedNative } = await getDeploymentContext();
  const deployments = await getDeployedContractsAddressList();
  const pairFactoryProxy = requireDeploymentAddress(deployments, AliasDeployedContracts.PairFactoryUpgradeable_Proxy);

  await saveToDeployedContractsAddressList(AliasDeployedContracts.WrappedNative, wrappedNative);

  const router = await deploy({
    name: InstanceName.RouterV2,
    deployer,
    constructorArguments: [pairFactoryProxy, wrappedNative],
    saveAlias: AliasDeployedContracts.RouterV2,
    verify: true,
  });

  const partialRouter = await deploy({
    name: InstanceName.UniswapV2PartialRouter,
    deployer,
    constructorArguments: [pairFactoryProxy, wrappedNative],
    saveAlias: AliasDeployedContracts.UniswapV2PartialRouter,
    verify: true,
  });

  assertAddressEquals('RouterV2.factory', await router.factory(), pairFactoryProxy);
  assertAddressEquals('RouterV2.wETH', await router.wETH(), wrappedNative);
  assertAddressEquals('UniswapV2PartialRouter.factory', await partialRouter.factory(), pairFactoryProxy);
  assertAddressEquals('UniswapV2PartialRouter.WETH', await partialRouter.WETH(), wrappedNative);

  console.log('Router wiring validated successfully.');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
