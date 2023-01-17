require('dotenv').config();
const ethers = require('ethers');
const { getEnv, waitForTx } = require('./utils');

const CurationJson = require('../build/contracts/Curation.json');

async function deployCuration(env) {
    let factory = new ethers.ContractFactory(CurationJson.abi, CurationJson.bytecode, env.wallet);
    let gasPrice = env.gasPrice;
    let contract = await factory.deploy(env.chainId, "0x36F18e8B735592dE9A32A417e482e106eAa0C77A", { gasPrice });
    await contract.deployed();
    console.log("✓ Curation contract deployed", contract.address);
}

async function main() {
    let env = await getEnv(false);
    await deployCuration(env)
}

main()
    .catch(console.error)
    .finally(() => process.exit());