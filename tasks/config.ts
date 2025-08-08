import 'dotenv/config';
interface ChainConfig {
  algebraTheGraph: string;
}

interface ChainsConfig {
  [key: string]: ChainConfig;
}

const chains: ChainsConfig = {};

export default {
  'extract-abis-to-docs': {
    output: 'docs/abi',
    minAbiFragmentsToInclude: 2,
    skipPatterns: [
      'mocks',
      'interfaces',
      '@openzeppelin',
      '@cryptoalgebra',
      'libraries',
      'IBaseV1Pair',
      'IWETH',
      'Math',
      'erc20',
      'BribeProxy',
      'GaugeProxy',
      'NestVaultProxy',
      'StrategyProxy',
    ],
  },
  'get-state': {
    output: 'docs/state',
    chains: chains,
  },
};
