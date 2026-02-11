import { HardhatUserConfig } from 'hardhat/config';
import { SolcUserConfig } from 'hardhat/types';
import '@nomicfoundation/hardhat-toolbox';
import '@nomicfoundation/hardhat-verify';
import 'hardhat-contract-sizer';
import 'dotenv/config';
import 'hardhat-ignore-warnings';
import 'hardhat-abi-exporter';
import './tasks';
import 'hardhat-tracer';

const DEFAULT_COMPILER_SETTINGS: SolcUserConfig = {
  version: '0.8.19',
  settings: {
    evmVersion: 'paris',
    viaIR: true,
    optimizer: {
      enabled: true,
      runs: 2000,
    },
    metadata: {
      bytecodeHash: 'none',
    },
  },
};
const VOTER_LOWEST_SIZE: SolcUserConfig = {
  version: '0.8.19',
  settings: {
    evmVersion: 'paris',
    viaIR: true,
    optimizer: {
      enabled: true,
      runs: 200,
    },
    metadata: {
      bytecodeHash: 'none',
    },
  },
};
const LOW_CONTRACT_SIZE_COMPILER_SETTINGS: SolcUserConfig = {
  version: '0.8.19',
  settings: {
    evmVersion: 'paris',
    viaIR: true,
    optimizer: {
      enabled: true,
      runs: 540,
    },
    metadata: {
      bytecodeHash: 'none',
    },
  },
};
const LOWEST_CONTRACT_SIZE_COMPILER_SETTINGS: SolcUserConfig = {
  version: '0.8.19',
  settings: {
    evmVersion: 'paris',
    viaIR: true,
    optimizer: {
      enabled: true,
      runs: 1,
    },
    metadata: {
      bytecodeHash: 'none',
    },
  },
};
const config: HardhatUserConfig = {
  sourcify: {
    enabled: true,
  },
  etherscan: {
    apiKey: {
      etherscan: `${process.env.ETHERSCAN_API_KEY}`,
      hyperEvm: `${process.env.ETHERSCAN_API_KEY}`,
      baseSepolia: `${process.env.ETHERSCAN_API_KEY}`,
    },
    customChains: [
      {
        network: 'hyperEvm',
        chainId: 999,
        urls: {
          apiURL: 'https://api.etherscan.io/v2/api?chainid=999',
          browserURL: 'https://hyperevmscan.io/',
        },
      },
      {
        network: 'baseSepolia',
        chainId: 84532,
        urls: {
          apiURL: 'https://api.etherscan.io/v2/api?chainid=84532',
          browserURL: 'https://sepolia.basescan.org',
        },
      },
    ],
  },
  networks: {
    hyperEvm: {
      url: `https://rpc.hyperliquid.xyz/evm`,
      chainId: 999,
      gasPrice: 2e9,
      accounts: {
        mnemonic: `${process.env.HYPER_EVM_MAINNET_MNEMONIC}`,
        path: "m/44'/60'/0'/0",
        initialIndex: 0,
        count: 20,
        passphrase: '',
      },
    },
    baseSepolia: {
      url: `${process.env.BASE_SEPOLIA_RPC || 'https://sepolia.base.org'}`,
      chainId: 84532,
      accounts: {
        mnemonic: `${process.env.HYPER_EVM_TESTNET_MNEMONIC}`,
        path: "m/44'/60'/0'/0",
        initialIndex: 0,
        count: 20,
        passphrase: '',
      },
    },
    hyperevm_testnet: {
      url: `https://rpc.hyperliquid-testnet.xyz/evm`,
      chainId: 998,
      accounts: {
        mnemonic: `${process.env.HYPER_EVM_TESTNET_MNEMONIC}`,
        path: "m/44'/60'/0'/0",
        initialIndex: 0,
        count: 20,
        passphrase: '',
      },
    },
    hardhat: {
      allowUnlimitedContractSize: true,
      forking: {
        enabled: !!process.env.FORK_ENABLED,
        url: `https://rpc.hyperliquid.xyz/evm`,
        blockNumber: 26999704, // Feb-11-2026 12:00:07 PM +UTC
      },
    },
  },
  solidity: {
    compilers: [DEFAULT_COMPILER_SETTINGS],
    overrides: {
      'contracts/core/VotingEscrowUpgradeableV2.sol': VOTER_LOWEST_SIZE,
      'contracts/core/VoterUpgradeableV2.sol': VOTER_LOWEST_SIZE,
      'contracts/core/VeArtProxy.sol': LOWEST_CONTRACT_SIZE_COMPILER_SETTINGS,
      'contracts/core/VeArtProxyStatic.sol': LOWEST_CONTRACT_SIZE_COMPILER_SETTINGS,
    },
  },
  warnings: {
    'contracts/mocks/**/*': {
      default: 'off',
    },
  },
  abiExporter: [
    {
      path: './abi/json',
      format: 'json',
    },
    {
      path: './abi/minimal',
      format: 'minimal',
    },
    {
      path: './abi/fullName',
      format: 'fullName',
    },
  ],
};

export default config;
