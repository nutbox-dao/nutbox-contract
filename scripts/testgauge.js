const GaugeJson = require('../build/contracts/Gauge.json')
const ContractAddress = require('./contracts.json')
const GaugeAddress = ContractAddress['Gauge']
const ethers = require('ethers')
require('dotenv').config();

async function unvote(pid, amount, env) {
    const contract = new ethers.Contract(GaugeAddress, GaugeJson.abi, env.wallet)
    try{
        const tx = await contract.unvote(pid, amount, {
            gasLimit: 200000,
            gasPrice: 5000000000
        })
        console.log(56, tx.hash);
    }catch(err) {
        console.log(2576, err);
    }
}

async function main() {
    let env = {}
    env.url = process.env.TESTENDPOINT;
    env.privateKey = process.env.TESTKEY;
    env.provider = new ethers.providers.JsonRpcProvider(env.url);
    env.wallet = new ethers.Wallet(env.privateKey, env.provider);
    env.gasPrice = await env.provider.getGasPrice();
    // env.gasPrice = env.gasPrice * 1.5
    console.log(`private: ${env.privateKey}, url: ${env.url}`);
    const pid = '0x10fe5a57fc5a4e314a1fbed4a0829c4c00fb5d13'
    await unvote(pid, ethers.utils.parseUnits('1.0', 18), env)
}

main()