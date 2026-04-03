require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-waffle");
require("hardhat-contract-sizer");
require("@nomicfoundation/hardhat-verify");
require("dotenv").config();

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
    // 部署脚本: npx hardhat run scripts/deploy-protocol.js --network bsc
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
  // 各链使用对应浏览器 API Key；未填则 verify 会报错提示
  etherscan: {
    apiKey: {
      arbitrumOne: process.env.ARB_KEY || "",
      bsc: process.env.BSC_KEY || "",
      bscTestnet: process.env.BSCSCAN_API_KEY || "",
    },
  },
};
