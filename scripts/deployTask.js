require('dotenv').config();
const ethers = require('ethers');

const TaskJson = require('../build/contracts/Task.json');

async function deployTaskContract(env) {
    let factory = new ethers.ContractFactory(TaskJson.abi, TaskJson.bytecode, env.wallet);
    let contract = await factory.deploy();
    await contract.deployed();
    console.log("✓ Task contract deployed", contract.address);
    return contract.address;
}

async function main() {
    let env = {};
    env.url = process.env.TESTENDPOINT || 'http://localhost:8545';
    env.privateKey = process.env.TESTKEY;
    env.provider = new ethers.providers.JsonRpcProvider(env.url);
    console.log(`private: ${env.privateKey}, url: ${env.url}`);
    env.wallet = new ethers.Wallet(env.privateKey, env.provider);
    env.gasLimit = ethers.utils.hexlify(Number(process.env.GASLIMIT));

    env.gasPrice = await env.provider.getGasPrice();

    const contract = await deployTaskContract(env)
    
    console.log(contract);
}

main()
  .catch(console.error)
  .finally(() => process.exit());