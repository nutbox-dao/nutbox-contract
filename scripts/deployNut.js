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

async function addAddressToWhiteList(address, env) {
    const contract = new ethers.Contract('0x4429FcdD4eC4EA4756B493e9c0525cBe747c2745', NUTTokenJson.abi, env.wallet);
    const res = await contract.setWhiteList(address);
    console.log(`Add ${address} to NUT whiteList`);
}

async function removeAddressToWhiteList(address, env) {
    const contract = new ethers.Contract('0x4429FcdD4eC4EA4756B493e9c0525cBe747c2745', NUTTokenJson.abi, env.wallet);
    const res = await contract.removeWhiteList(address);
    console.log(`Remove ${address} to NUT whiteList`);
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

    // const NUT = await deployNutContract(env);
    await addAddressToWhiteList('0x7aaf0d8a812Ad5438B5162233511d83cA84aA295', env);
}

main()
  .catch(console.error)
  .finally(() => process.exit());