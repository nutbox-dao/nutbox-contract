require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-waffle");
require('hardhat-contract-sizer');
require("@nomicfoundation/hardhat-verify");
// require("@nomicfoundation/hardhat-chai-matchers")
require('dotenv').config();

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    version: "0.8.0",
    settings: {
      optimizer: {
        enabled:true,
        runs: 1
      },
      evmVersion: "constantinople"
    }
  },
  networks: {
    hardhat: {
      chainId: 1337,
    },
    localhost: {
      url: "http://localhost:8545",
    },
    arbitrum: {
      url: 'https://arb1.arbitrum.io/rpc',
      chainId: 42161,
      accounts: [process.env.MAIN_KEY]
    }
  },
  etherscan: {
    apiKey: process.env.ARB_KEY
  }
  // contractSizer: {
  //   alphaSort: true,
  //   runOnCompile: true,
  //   disambiguatePaths: false
  // }
};
