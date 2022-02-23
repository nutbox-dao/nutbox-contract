require('dotenv').config();
const ethers = require('ethers');
const fs = require("fs");

const PnutExchangeJson = require('../build/contracts/PnutExchange.json');

async function deployPnutExchangeContract(env) {
    const oldPnut = '0x0d66aB1bb0D3E71211829c6D920eF933b8FE5122';
    const newPnut = '';
    let factory = new ethers.ContractFactory(PnutExchangeJson.abi, PnutExchangeJson.bytecode, env.wallet);
    let contract = await factory.deploy(
        oldPnut,
        newPnut,
        { gasPrice: env.gasPrice, gasLimit: env.gasLimit}
    );
    await contract.deployed();
    env.PnutExchange = contract.address;
    console.log("✓ PnutExchange contract deployed", contract.address);
}

async function main() {
    let env = {};
    env.url = process.env.ENDPOINT || 'http://localhost:8545';
    env.privateKey = process.env.KEY;
    env.provider = new ethers.providers.JsonRpcProvider(env.url);
    env.wallet = new ethers.Wallet(env.privateKey, env.provider);
    env.gasLimit = ethers.utils.hexlify(Number(process.env.GASLIMIT));
    env.gasPrice = ethers.utils.hexlify(Number(process.env.GASPRICE));

    await deployPnutExchangeContract(env);
}

main()