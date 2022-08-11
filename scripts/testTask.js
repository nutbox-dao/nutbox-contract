
require('dotenv').config();
const ethers = require('ethers');
const { waitForTx } = require('./utils')
const _ = require('lodash');

const TaskJson = require('../build/contracts/Task.json');

const TaskContract = '0x38468F161BAC57aacD1E2c37aB279D6bfDBe3405'  // bsc test
const rewardToken = '0x328916Db048F3CfEb4445F90E14899d0296e33Aa'   // bsc test
const id1 = '20897562454544561';
const id2 = '1494651648945154';

async function createNewTask(provider, contract, id, endTime, token, amount) {
    const tx = await contract.createNewTask(id, endTime, token, amount)
    await waitForTx(provider, tx.hash)
}

async function commitList(provider, contract, id, addresses, amounts) {
    const addressBatches = _.chunk(addresses, 500);
    const amountBatches = _.chunk(amounts, 500);
    for (let i = 0; i < addressBatches.length; i++) {
        const tx = await contract.commitList(id, addressBatches[i], amountBatches[i], i == addressBatches.length - 1);
        await waitForTx(provider, tx.hash);
        const taskInfo = await contract.taskInfo(id);
        const openningTasks = await contract.openningTasks();
        const list = await contract.getRewardList(id, i);
        const list2 = await contract.getRewardList(id, 2);
        console.log(1, taskInfo);
        console.log(2,openningTasks);
        console.log(3, list[0]);
        console.log(4, list2);
    }
}

async function cancel(provider, contract, id) {
    const tx = await contract.cancelTask(id);
    await waitForTx(provider, tx.hash);
    const taskInfo = await contract.taskInfo(id);
    const openningTasks = await contract.openningTasks();
    console.log(taskInfo, openningTasks);
}

async function distribute(provider, contract, id) {

}

function generateList(n) {
    let addresses = []
    let amounts = []
    let amount = 0;
    for (let i = 0; i < n; i++) {
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