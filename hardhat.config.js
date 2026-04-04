require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-ignition-ethers");
require("@nomicfoundation/hardhat-verify");
require("hardhat-contract-sizer");
require("dotenv").config();

// 验证 API：
// - 默认：Etherscan V2（须在 https://etherscan.io/apidashboard 创建 Multichain Key）
// - 若只有 BscScan 旧站 Key：设 USE_BSCSCAN_LEGACY_VERIFY=1，并用 BSCSCAN_API_KEY（或 BSC_KEY）
const useLegacyBscscanVerify =
  process.env.USE_BSCSCAN_LEGACY_VERIFY === "1";

const ETHERSCAN_V2_API_KEY =
  process.env.BSC_API_KEY ||
  process.env.ETHERSCAN_API_KEY ||
  process.env.BSC_KEY ||
  process.env.ARB_KEY ||
  "";

const legacyBscKey =
  process.env.BSCSCAN_API_KEY || process.env.BSC_KEY || "";

const bscVerifyKey = useLegacyBscscanVerify
  ? legacyBscKey
  : ETHERSCAN_V2_API_KEY;

// Legacy BscScan 必须用 api.bscscan.com；若仍配成 Etherscan V2 URL，验证阶段可能读到错误元数据（例如误报 solidity <0.4.7）。
const bscExplorerUrls = useLegacyBscscanVerify
  ? {
      apiURL: "https://api.bscscan.com/api",
      browserURL: "https://bscscan.com",
    }
  : {
      apiURL: "https://api.etherscan.io/v2/api?chainid=56",
      browserURL: "https://bscscan.com",
    };

const bscTestnetExplorerUrls = useLegacyBscscanVerify
  ? {
      apiURL: "https://api-testnet.bscscan.com/api",
      browserURL: "https://testnet.bscscan.com",
    }
  : {
      apiURL: "https://api.etherscan.io/v2/api?chainid=97",
      browserURL: "https://testnet.bscscan.com",
    };

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: { enabled: true, runs: 1 },
      evmVersion: "paris",
      viaIR: true,
    },
  },
  networks: {
    hardhat: { chainId: 1337 },
    localhost: { url: "http://localhost:8545" },
    arbitrum: {
      url: "https://arb1.arbitrum.io/rpc",
      chainId: 42161,
      accounts: process.env.MAIN_KEY ? [process.env.MAIN_KEY] : [],
    },
    bsc: {
      url: process.env.BSC_RPC || "https://bsc-dataseed.binance.org",
      chainId: 56,
      accounts: process.env.DEPLOY_KEY ? [process.env.DEPLOY_KEY] : [],
    },
    bscTestnet: {
      url: process.env.BSC_TESTNET_RPC || "https://data-seed-prebsc-1-s1.binance.org:8545",
      chainId: 97,
      accounts: process.env.DEPLOY_KEY ? [process.env.DEPLOY_KEY] : [],
    },
  },
  etherscan: {
    apiKey: {
      arbitrum: ETHERSCAN_V2_API_KEY,
      bsc: bscVerifyKey,
      bscTestnet: bscVerifyKey,
    },
    customChains: [
      {
        network: "bsc",
        chainId: 56,
        urls: bscExplorerUrls,
      },
      {
        network: "bscTestnet",
        chainId: 97,
        urls: bscTestnetExplorerUrls,
      },
      {
        network: "arbitrum",
        chainId: 42161,
        urls: {
          apiURL: "https://api.etherscan.io/v2/api?chainid=42161",
          browserURL: "https://arbiscan.io",
        },
      },
    ],
  },
};
