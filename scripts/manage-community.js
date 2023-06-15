const { ethers } = require('ethers')
const CommunityJson = require('../build/contracts/Community.json')
require('dotenv').config();


// functions:

// adminSetDev(address);
// adminWithdrawRevenue();
// adminSetFeeRatio(uint16);
// adminAddPool(string,uint16[],address,bytes);
// adminClosePool(address,address[],uint16[]);
// adminSetPoolRatios(uint16[]);

const communityContract = '0x2Fdfb2e13eD1B0691fce6eBE367643e98081A871';
let contract;
let env = {};

async function initProvider() {
    env.url = process.env.MAIN_RPC;
    env.privateKey = process.env.MAIN_KEY;
    env.provider = new ethers.providers.JsonRpcProvider(env.url);
    env.wallet = new ethers.Wallet(env.privateKey, env.provider);
    env.gasPrice = await env.provider.getGasPrice();
    // env.gasPrice = env.gasPrice * 1.5
    console.log(`private: ${env.privateKey}, url: ${env.url}`);
}

async function initCommunityContract() {
    contract = new ethers.Contract(communityContract, CommunityJson.abi, env.wallet);
}

async function getRewardCalculator() {
    const calculator = await contract.rewardCalculator();
    console.log("claculator is:", calculator);
    return calculator;
}

async function activedPools() {
    const pools = await contract.activedPools(2);
    console.log("activied pools:", pools);
    return pools;
}

async function owner() {
    const owner = await contract.owner();
    console.log('owner is:', owner)
    return owner
}

async function main() {
    await initProvider();
    await initCommunityContract();
    await owner();
}

main();