require('dotenv').config();
const ethers = require('ethers');
const { getEnv, waitForTx } = require('./utils');

const Tradable721Json = require('../build/contracts/Tradable721.json');

async function deployContract(env) {
    let factory = new ethers.ContractFactory(Tradable721Json.abi, Tradable721Json.bytecode, env.wallet);
    let contract = await factory.deploy("Liquidation NFT", "LNFT", { gasPrice: env.gasPrice });
    await contract.deployed();
    console.log("✓ Tradable721 contract deployed", contract.address);

    // let contract = new ethers.Contract("0x74FC2316554d976651c23fcCD1FA74e91E9DC698", Tradable721Json.abi, env.wallet);

    await contract.setBaseURI("https://gateway.nutbox.app/ipfs/", { gasPrice: env.gasPrice });
    console.log("✓ Set the base URI");

    await contract.grantRole("0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6", "0x93045828065a3bc3f4c6012FDA746eD9d79FCDb7", { gasPrice: env.gasPrice });
    console.log("✓ Set the role");
}

async function main() {
    let env = await getEnv();
    await deployContract(env)
}

main()
    .catch(console.error)
    .finally(() => process.exit());