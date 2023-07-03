const Committee = require('../build/contracts/Committee.json')
const ContractAddress = require('./contracts.json')
const CommitteeAddress = ContractAddress['Committee']
const ethers = require('ethers')
require('dotenv').config();

async function main() {
    let env = {}
    env.url = process.env.ENULS_RPC;
    env.privateKey = process.env.ENULS_KEY;
    env.provider = new ethers.providers.JsonRpcProvider(env.url);
    env.wallet = new ethers.Wallet(env.privateKey, env.provider);
    env.gasPrice = await env.provider.getGasPrice();
    // env.gasPrice = env.gasPrice * 1.5
    console.log(`private: ${env.privateKey}, url: ${env.url}`);

   const committeeContract = new ethers.Contract(CommitteeAddress, Committee.abi, env.wallet);

   let tx = await committeeContract.adminSetFee(
    'COMMUNITY', 
    ethers.utils.parseUnits('0', 18), {gasPrice: 100000000});
    tx = await committeeContract.adminSetFee(
    'USER', 
    ethers.utils.parseUnits('0', 18), {gasPrice: 100000000});
}

main()