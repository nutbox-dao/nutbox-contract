require('dotenv').config();
const ethers = require('ethers');
const { getEnv, waitForTx, sleep } = require('../scripts/utils');
const _ = require('lodash');

const TaskJson = require('../build/contracts/Task.json');
const FundJson = require("../build/contracts/TaskWormholeFund.json");
const erc20Json = require('../build/contracts/ERC20PresetMinterPauser.json')

const taskAddress = "0x35c3DE26BB7f839f8E998c076EdAabA3181b8169";
const fundAddress = "0xBF0ef6407E455D459094f11f84773788485E105B";
const erc20Address = "0x14489dC352D78AdF01107ff0bfCdF3efdbc96920";

const id1 = '208975624545445';
const id2 = '149465164894515';

function randomEthAddress() {
    const key = ethers.utils.randomBytes(32);
    const wallet = new ethers.Wallet(key);
    return wallet.address;
}

function generateList(n) {
    let addresses = [];
    let amounts = [];
    let twitters = [];
    let amount = 0;
    for (let i = 0; i < n; i++) {
        const address = randomEthAddress()
        addresses.push(address);
        const m = parseInt(address.slice(20, 30), 16);
        twitters.push(`${m}`);
        amounts.push(m)
        amount += m;
    }
    return [addresses, amounts, twitters, amount];
}

async function createNewTask(provider, contract, id, endTime, token, amount) {
    console.log("createNewTask: ", id, endTime, token, amount)
    const tx = await contract.newTask(id, endTime, token, amount, 10, 1000);
    await waitForTx(provider, tx.hash)
}

async function commitList(provider, contract, id, addresses, amounts, twitters) {
    const addressBatches = _.chunk(addresses, 300);
    const twitterBatches = _.chunk(twitters, 300);
    const amountBatches = _.chunk(amounts, 300);
    for (let i = 0; i < addressBatches.length; i++) {
        console.log("commitList: ", id, i, addressBatches[i].length);
        const tx = await contract.commitList(id, addressBatches[i], amountBatches[i], twitterBatches[i], i == addressBatches.length - 1);
        await waitForTx(provider, tx.hash);
        await sleep(2000);
        // const taskInfo = await contract.taskInfo(id);
        // const openningTasks = await contract.openningTasks();
        // console.log(1, taskInfo);
        // console.log(2, openningTasks);
    }
}

async function distribute(provider, contract, id, limit = 500) {
    console.log("distribute: ", id, limit)
    let tx = await contract.distribute(id, limit);
    await waitForTx(provider, tx.hash)
    // let taskInfo = await contract.taskInfo(id);
    // let openningTasks = await contract.openningTasks();
    // console.log(6, taskInfo);
    // console.log(7, openningTasks);
}

async function main() {
    let env = await getEnv();
    const Task = new ethers.Contract(taskAddress, TaskJson.abi, env.wallet);
    const Fund = new ethers.Contract(fundAddress, FundJson.abi, env.wallet);
    const Erc20 = new ethers.Contract(erc20Address, erc20Json.abi, env.wallet);

    let [addresses, amounts, twitters, amount] = generateList(398);

    console.log("approve to %s...", taskAddress);
    let tx = await Erc20.approve(taskAddress, ethers.constants.MaxUint256);
    await waitForTx(env.provider, tx.hash);

    console.log("transfer to %s...", env.wallet.address);
    tx = await Erc20.mint(env.wallet.address, amount);
    await waitForTx(env.provider, tx.hash);

    // task1
    await createNewTask(env.provider, Task, id1, parseInt(new Date().getTime() / 1000 + 5), erc20Address, amount)
    let taskInfo = await Task.taskInfo(id1);
    console.log("task1: ", taskInfo);

    await sleep(6000);

    await commitList(env.provider, Task, id1, addresses, amounts, twitters);
    await Task.cleanList(id1, 500);
    taskInfo = await Task.taskInfo(id1);
    console.log("cleanList: ", taskInfo);

    await commitList(env.provider, Task, id1, addresses, amounts, twitters);
    await sleep(2000);
    await distribute(env.provider, Task, id1, 300);
    await sleep(2000);
    await distribute(env.provider, Task, id1, 300);

    // task2
    [addresses, amounts, twitters, amount] = generateList(639);

    console.log("set fund %s ...", fundAddress);
    tx = await Task.setFundContract(fundAddress);
    await waitForTx(env.provider, tx.hash);

    console.log("set task %s ...", taskAddress);
    tx = await Fund.setTaskContract(taskAddress);
    await waitForTx(env.provider, tx.hash);

    console.log("transfer to %s...", env.wallet.address);
    tx = await Erc20.mint(env.wallet.address, amount);
    await waitForTx(env.provider, tx.hash);

    await createNewTask(env.provider, Task, id2, parseInt(new Date().getTime() / 1000 + 5), erc20Address, amount)
    taskInfo = await Task.taskInfo(id2);
    console.log("task2: ", taskInfo);

    await sleep(6000);

    console.log("replace address ...");
    let indexs = [1, 10, 20, 200];
    const addr0 = "0x0000000000000000000000000000000000000000";
    let tIds = [];
    let tAddress = [];
    let tAmounts = [];
    for (let i = 0; i < indexs.length; i++) {
        tIds.push(twitters[indexs[i]]);
        tAddress.push(addresses[indexs[i]]);
        tAmounts.push(amounts[indexs[i]]);
        addresses[indexs[i]] = addr0;
    }
    console.log("save info: ");
    console.log("\t%s", tIds);
    console.log("\t%s", tAddress);
    console.log("\t%s", tAmounts);

    await commitList(env.provider, Task, id2, addresses, amounts, twitters);
    await distribute(env.provider, Task, id2, 300);
    await sleep(2000);
    await distribute(env.provider, Task, id2, 300);
    await sleep(2000);
    await distribute(env.provider, Task, id2, 300);

    let ps = [Erc20.balanceOf(fundAddress)];
    tAddress.forEach(addr => {
        ps.push(Erc20.balanceOf(addr));
    });
    let results = await Promise.all(ps);
    console.log("Fund constract balance: %s", results[0]);
    let ubs = results.slice(1);
    for (let i = 0; i < ubs.length; i++) {
        console.log("[%s][%s] balance: %s", tAddress[i], tIds[i], ubs[i]);
    }

    console.log("set user address ...");
    tx = await Fund.setUserAddress(tIds, tAddress);
    await waitForTx(env.provider, tx.hash);

    for (let i = 0; i < tIds.length; i++) {
        let ts = await Fund.getUserTokens(tIds[i]);
        console.log("%s : %s %s", tIds[i], ts.tokens, ts.amounts.map(value => value.toString()));
    }

    console.log("Claim user rewards in batches ...");
    tx = await Fund.claimBatch(tIds);
    await waitForTx(env.provider, tx.hash);

    ps = [
        Task.getRewardList(id1, 0),
        Task.getRewardList(id2, 0),
        Task.getRewardList(id2, 1),
        Task.taskInfo(id1),
        Task.taskInfo(id2),
        Erc20.balanceOf(taskAddress),
        Erc20.balanceOf(fundAddress)
    ];
    tAddress.forEach(addr => {
        ps.push(Erc20.balanceOf(addr));
    });

    results = await Promise.all(ps);
    console.log("=============================Test end==========================");
    console.log("users: id1 =", results[0].length, " id2 =", results[1].length + results[2].length);
    console.log("id1 user1: ", results[0][0]);
    console.log("Task constract balance: %s", results[5]);
    console.log("Fund constract balance: %s", results[6]);
    ubs = results.slice(7);
    for (let i = 0; i < ubs.length; i++) {
        console.log("[%s][%s] balance: %s", tAddress[i], tIds[i], ubs[i]);
    }
    console.log("Task id1: ", results[3]);
    console.log("Task id2: ", results[4]);
}

main()
    .catch(console.error)
    .finally(() => process.exit());