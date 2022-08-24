
require('dotenv').config();
const ethers = require('ethers');
const { waitForTx, sleep } = require('./utils')
const _ = require('lodash');

const TaskJson = require('../build/contracts/Task.json');
const ERC20Json = require('../build/contracts/ERC20.json');

const TaskContract = '0xF470fc7B223D06104d34efB45fF157A6368025db'  // bsc test
const rewardToken = '0xBa222C854FF80fA765Bb3Bc36e841f923eC18161'   // bsc test
const id1 = '208975624545445';
const id2 = '149465164894515';

async function createNewTask(provider, contract, id, endTime, token, amount) {
    console.log("createNewTask: ", id, endTime, token, amount)
    const tx = await contract.newTask(id, endTime, token, amount, 10, 1000, 1)
    await waitForTx(provider, tx.hash)
}

async function commitList(provider, contract, id, addresses, amounts) {
    const addressBatches = _.chunk(addresses, 300);
    const amountBatches = _.chunk(amounts, 300);
    for (let i = 0; i < addressBatches.length; i++) {
        console.log("commitList: ", id, i, addressBatches[i].length);
        const tx = await contract.commitList(id, addressBatches[i], amountBatches[i], i == addressBatches.length - 1);
        await waitForTx(provider, tx.hash);
        await sleep(5000);
        const taskInfo = await contract.taskInfo(id);
        const openningTasks = await contract.openningTasks();
        console.log(1, taskInfo);
        console.log(2, openningTasks);
    }
}

async function distribute(provider, contract, id, limit = 500) {
    console.log("distribute: ", id, limit)
    let tx = await contract.distribute(id, limit);
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
    env.provider = new ethers.providers.JsonRpcProvider({ url: env.url, timeout: 1200000 });
    console.log(`private: ${env.privateKey}, url: ${env.url}`);
    env.wallet = new ethers.Wallet(env.privateKey, env.provider);
    env.gasLimit = ethers.utils.hexlify(Number(process.env.GASLIMIT));

    env.gasPrice = await env.provider.getGasPrice();

    const contract = new ethers.Contract(TaskContract, TaskJson.abi, env.wallet)
    const ercContract = new ethers.Contract(rewardToken, ERC20Json.abi, env.wallet);

    let tx = await ercContract.approve(TaskContract, ethers.constants.MaxUint256);
    await waitForTx(env.provider, tx.hash);

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
    await sleep(2000);
    await distribute(env.provider, contract, id1, 300);
    await sleep(2000);
    await distribute(env.provider, contract, id1, 300);

    // task2
    [addresses, amounts, amount] = generateList(639);
    await createNewTask(env.provider, contract, id2, parseInt(new Date().getTime() / 1000 + 5), rewardToken, amount)
    taskInfo = await contract.taskInfo(id2);
    console.log(0, taskInfo);

    await sleep(8000);

    await commitList(env.provider, contract, id2, addresses, amounts);
    await distribute(env.provider, contract, id2, 300);
    await sleep(2000);
    await distribute(env.provider, contract, id2, 300);
    await sleep(2000);
    await distribute(env.provider, contract, id2, 300);

    Promise.all([
        contract.getRewardList(id1, 0),
        contract.getRewardList(id2, 0),
        contract.getRewardList(id2, 1),
        contract.taskInfo(id1),
        contract.taskInfo(id2)
    ]).then(results => {
        console.log("users: id1 =", results[0].length, " id2 =", results[1].length + results[2].length);
        console.log("id1 user1: ", results[0][0]);
        console.log(id1 + ": ", results[3]);
        console.log(id2 + ": ", results[4]);
    });
}

main()