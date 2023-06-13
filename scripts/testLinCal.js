const LinearCalculator = require('../build/contracts/LinearCalculator.json')
const ethers = require('ethers');
const { waitForTx } = require('./utils');
require('dotenv').config();

const LinearCalculatorAddress = '0x5A95D35579C3aaF7F1df86540286A9DD90506F00'

async function main() {
    let env = {}
    env.url = process.env.TESTENDPOINT;
    env.privateKey = process.env.TESTKEY;
    env.provider = new ethers.providers.JsonRpcProvider(env.url);
    env.wallet = new ethers.Wallet(env.privateKey, env.provider);
    env.gasPrice = await env.provider.getGasPrice();
    // env.gasPrice = env.gasPrice * 1.5
    console.log(`private: ${env.privateKey}, url: ${env.url}`);

    const contract = new ethers.Contract(LinearCalculatorAddress, LinearCalculator.abi, env.wallet)
    try{
        const block = await env.provider.getBlockNumber()
        const revv = await contract.calculateReward('0x98cbf5e5951c2b384f22c4896574f43f501f980e', 100800000, 130800000)
        console.log(56, revv.toString() / 1e18);
        const rewardPerblock = await contract.getCurrentRewardPerBlock('0x98CbF5E5951C2B384f22c4896574f43F501f980e');
        console.log(37, rewardPerblock)
        const po = await contract.distributionErasMap('0x98cbf5e5951c2b384f22c4896574f43f501f980e', 0);
        console.log(38, po.startHeight.toString(), po.stopHeight.toString())
        console.log(38, block.toString())

    }catch(err) {
        console.log(2576, err);
    }
}

main()