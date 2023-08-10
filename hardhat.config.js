require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-waffle");
require('hardhat-contract-sizer');
require("@nomicfoundation/hardhat-verify");
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
    },
    linea: {
      url: 'https://rpc.linea.build',
      chainId: 59144,
      accounts: [process.env.MAIN_KEY]
    }
  },
  // verify contract: npx hardhat --network linea <contract address> <params>
  etherscan: {
    apiKey:{
      linea:  process.env.LINEA_KEY
    },
    customChains: [
      {
        network: "linea",
        chainId: 59144,
        urls: {
          apiURL: "https://api.lineascan.build/api",
          browserURL: "https://lineascan.build/"
        }
      }
    ]
  }
  // contractSizer: {
  //   alphaSort: true,
  //   runOnCompile: true,
  //   disambiguatePaths: false
  // }

};
