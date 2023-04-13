require('dotenv').config();
const ethers = require('ethers');
const { getEnv, deployContract } = require('./utils');

const Multicall3Json = require('../build/contracts/Multicall3.json');


async function main() {
    let env = await getEnv(false);
    await deployContract(env, Multicall3Json);
}

main()
    .catch(console.error)
    .finally(() => process.exit());