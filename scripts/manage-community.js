const { ethers } = require('ethers')
const CommunityJson = require('../build/contracts/Community.json')

// functions:

// adminSetDev(address);
// adminWithdrawRevenue();
// adminSetFeeRatio(uint16);
// adminAddPool(string,uint16[],address,bytes);
// adminClosePool(address,address[],uint16[]);
// adminSetPoolRatios(uint16[]);

const communityContract = '';
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
    
}

