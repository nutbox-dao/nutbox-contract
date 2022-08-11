
require('dotenv').config();
const ethers = require('ethers');
const { waitForTx } = require('./utils')
const _ = require('lodash');

const TaskJson = require('../build/contracts/Task.json');

const TaskContract = '0x38468F161BAC57aacD1E2c37aB279D6bfDBe3405'  // bsc test
const rewardToken = '0x328916Db048F3CfEb4445F90E14899d0296e33Aa'   // bsc test

async function createNewTask(provider, contract, id, endTime, token, amount) {
    const tx = await contract.createNewTask(id, endTime, token, amount)
    await waitForTx(provider, tx.hash)
}

async function commitList(provider, contract, addresses, amounts) {
    const addressBatches = _.chunk(addresses, 500);
    const amountBatches = _.chunk(amounts, 500);
    for (let i = 0; i < addressBatches.length; i++) {
        const tx = await contract.commitList(id, addressBatches[i], amountBatches[i], i == addressBatches.length - 1);
        await waitForTx(provider, tx.hash);
        
    }
}

function generateList() {
    let addresses = []
    let amounts = []
    let amount = 0;
    for (let i = 0; i < 532; i++) {
        const address = randomEthAddress()
        addresses.push(address);
        const m = parseInt(address.slice(20, 30), 16);
        amounts.push(m)
        amount += m;
    }   
    return [addresses, amounts, amount]
}

function randomEthAddress() {
    const key = ethers.utils.randomBytes(32);
    const wallet = new ethers.Wallet(key);
    return wallet.address;
}

async function main() {
    const [addressed, amounts, amount] = generateList();
    let env = {};
    env.url = process.env.TESTENDPOINT || 'http://localhost:8545';
    env.privateKey = process.env.TESTKEY;
    env.provider = new ethers.providers.JsonRpcProvider(env.url);
    console.log(`private: ${env.privateKey}, url: ${env.url}`);
    env.wallet = new ethers.Wallet(env.privateKey, env.provider);
    env.gasLimit = ethers.utils.hexlify(Number(process.env.GASLIMIT));

    env.gasPrice = await env.provider.getGasPrice();

    const contract = new ethers.Contract(TaskContract, TaskJson.abi, env.wallet)
}

main()