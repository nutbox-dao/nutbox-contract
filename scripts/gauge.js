require('dotenv').config();
const ethers = require('ethers');
const contracts = require("./contracts.json");
const { waitForTx } = require('./utils')
const Gauge = require('../build/contracts/Gauge.json');

const gaugeAddress = contracts['Gauge']

async function main () {
    let env = {};
    env.url = process.env.TESTENDPOINT || 'http://localhost:8545';
    env.privateKey = process.env.TESTKEY;
    env.provider = new ethers.providers.JsonRpcProvider(env.url);
    console.log(`private: ${env.privateKey}, url: ${env.url}`);
    env.wallet = new ethers.Wallet(env.privateKey, env.provider);
    env.gasLimit = ethers.utils.hexlify(Number(process.env.GASLIMIT));
    env.gasPrice = await env.provider.getGasPrice();

    // set nut inspire
    const gauge = new ethers.Contract(gaugeAddress, Gauge.abi, env.wallet)
    const tx = await gauge.adminSetRewardNUTPerBlock(ethers.utils.parseUnits('1.0', 18))
    console.log('tx:', tx.hash);
}


main()
