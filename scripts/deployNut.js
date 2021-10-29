require('dotenv').config();
const ethers = require('ethers');
const fs = require("fs");

const NUTTokenJson = require('../build/contracts/NUTToken.json');

async function deployNutContract(env) {
    let factory = new ethers.ContractFactory(NUTTokenJson.abi, NUTTokenJson.bytecode, env.wallet);
    let contract = await factory.deploy(
        'Nutbox',
        'NUT',
        ethers.utils.parseUnits("20000000.0", 18),
        '0x7b1941AE388f62d5Caf20D4f709Aafd74001ff58',
        { gasPrice: env.gasPrice, gasLimit: env.gasLimit}
    );
    await contract.deployed();
    console.log("✓ NUTToken contract deployed", contract.address);
    return contract.address;
}

async function main() {
    let env = {};
    env.url = process.env.ENDPOINT || 'http://localhost:8545';
    env.privateKey = process.env.KEY;
    env.provider = new ethers.providers.JsonRpcProvider(env.url);
    console.log(`private: ${env.privateKey}, url: ${env.url}`);
    env.wallet = new ethers.Wallet(env.privateKey, env.provider);
    env.gasLimit = ethers.utils.hexlify(Number(process.env.GASLIMIT));
    env.gasPrice = await env.provider.getGasPrice();

    const NUT = await deployNutContract(env);
    const contract = new ethers.Contract(NUT, NUTTokenJson.abi, env.wallet);
    const res = await contract.setWhiteList('0x7b1941AE388f62d5Caf20D4f709Aafd74001ff58');
    console.log(res);
}

main()
  .catch(console.error)
  .finally(() => process.exit());