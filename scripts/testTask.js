
require('dotenv').config();
const ethers = require('ethers');
const { waitForTx, sleep } = require('./utils')
const _ = require('lodash');

const TaskJson = require('../build/contracts/Task.json');
const ERC20Json = require('../build/contracts/ERC20.json');

const TaskContract = '0xb945b0616f508b7d9782e2DBD3c966b6Ef194313'  // bsc test
const rewardToken = '0x4fB809615d0D60053850A78546a4B4B80C02A7F0'   // bsc test
const id1 = '208975624545445';
const id2 = '149465164894515';

async function createNewTask(provider, contract, id, endTime, token, amount) {
    const tx = await contract.newTask(id, endTime, token, amount, 10, 1000, 1)
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
        console.log(2, openningTasks);
        console.log(3, list[0]);
        console.log(4, list2);
    }
}

async function distribute(provider, contract, id) {
    let tx = await contract.distribute(id);
    await waitForTx(provider, tx.hash)
    let taskInfo = await contract.taskInfo(id);
    let openningTasks = await contract.openningTasks();
    console.log(6, taskInfo);
    console.log(7, openningTasks);
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
    let [addresses, amounts, amount] = generateList(398);
    let env = {};
    env.url = process.env.TESTENDPOINT || 'http://localhost:8545';
    env.privateKey = process.env.TESTKEY;
    env.provider = new ethers.providers.JsonRpcProvider(env.url);
    console.log(`private: ${env.privateKey}, url: ${env.url}`);
    env.wallet = new ethers.Wallet(env.privateKey, env.provider);
    env.gasLimit = ethers.utils.hexlify(Number(process.env.GASLIMIT));

    env.gasPrice = await env.provider.getGasPrice();

    const contract = new ethers.Contract(TaskContract, TaskJson.abi, env.wallet)
    const ercContract = new ethers.Contract(rewardToken, ERC20Json.abi, env.wallet);

    let tx = await ercContract.approve(TaskContract, ethers.constants.MaxUint256);
    await waitForTx(env.provider, tx.hash)

    // task1
    await createNewTask(env.provider, contract, id1, parseInt(new Date().getTime() / 1000 + 5), rewardToken, amount)
    let taskInfo = await contract.taskInfo(id1);
    console.log(0, taskInfo);

    await sleep(8000);

    await commitList(env.provider, contract, id1, addresses, amounts);
    await contract.cleanList(id1, 500);
    taskInfo = await contract.taskInfo(id1);
    console.log("cleanList: ", taskInfo);
    await commitList(env.provider, contract, id1, addresses, amounts);
    await distribute(env.provider, contract, id1);

    // task2
    [addresses, amounts, amount] = generateList(639);
    await createNewTask(env.provider, contract, id2, parseInt(new Date().getTime() / 1000 + 5), rewardToken, amount)
    taskInfo = await contract.taskInfo(id2);
    console.log(0, taskInfo);

    await sleep(8000);

    await commitList(env.provider, contract, id2, addresses, amounts);

    await distribute(env.provider, contract, id2);
    await distribute(env.provider, contract, id2);



}

main()