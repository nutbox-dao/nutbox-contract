require('dotenv').config();
const ethers = require('ethers');
const ExecutorJson = require('../build/contracts/Executor.json');
const ExecutorAddress = require('./contracts').Executor;

async function main() {
    let env = {};
    env.url = process.env.ENDPOINT || 'http://localhost:8545';
    env.privateKey = process.env.KEY;
    env.provider = new ethers.providers.JsonRpcProvider(env.url);
    console.log(`private: ${env.privateKey}, url: ${env.url}`);
    env.wallet = new ethers.Wallet(env.privateKey, env.provider);
    env.gasLimit = ethers.utils.hexlify(Number(process.env.GASLIMIT));
    env.gasPrice = await env.provider.getGasPrice();
    console.log((await env.provider.getGasPrice()).toString());
    // const contract = new ethers.Contract(ExecutorAddress, ExecutorJson.abi, env.wallet);
    // const tx = await contract.adminRenonceAdmin('0x57747260d8e08f66eDD1954B3A41F9ed417A6cDc');
    // console.log(tx.hash);
}

main()
  .catch(console.error)
  .finally(() => process.exit());