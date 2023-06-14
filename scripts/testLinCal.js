const LinearCalculator = require('../build/contracts/LinearCalculator.json');
const BlockJson = require('../build/contracts/Block.json');
const ethers = require('ethers');
const { waitForTx } = require('./utils');
require('dotenv').config();

const LinearCalculatorAddress = '0xa3e53F30C9cc6d174a98b311676e026535326f42'

async function deploy(env) {
    let factory = new ethers.ContractFactory(BlockJson.abi, BlockJson.bytecode, env.wallet);
    let contract = await factory.deploy();
    await contract.deployed();
    console.log("✓ Block contract deployed", contract.address);
    return contract.address;
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

    // const blockcontractaddress = await deploy(env);
    // const blockcontract = new ethers.Contract(blockcontractaddress, BlockJson.abi, env.wallet);
    // console.log('block contract address', blockcontractaddress)
    // const block = await blockcontract.getBlock();
    // console.log(325, block.toString())
    // const block2 = await blockcontract.getArbBlock();
    // console.log(55, block2.toString())
    
    // return;

    const contract = new ethers.Contract(LinearCalculatorAddress, LinearCalculator.abi, env.wallet)
    try{
        const block = await env.provider.getBlockNumber()
        const revv = await contract.blockNum()
        console.log(56, block.toString(), revv.toString());

    }catch(err) {
        console.log(2576, err);
    }
}

main()