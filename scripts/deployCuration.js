require('dotenv').config();
// const ethers = require('ethers');
const { getEnv, deployContract } = require('./utils');

const CurationJson = require('../build/contracts/Curation.json');

async function deployCuration(env) {
    // let factory = new ethers.ContractFactory(CurationJson.abi, CurationJson.bytecode, env.wallet);
    // let gasPrice = env.gasPrice;
    // let contract = await factory.deploy(env.chainId, "0x4A584E33Dec216a124E36Aceb0B06Bc37642027B", { gasPrice });
    // await contract.deployed();
    // console.log("✓ Curation contract deployed", contract.address);

    await deployContract(env, CurationJson, [env.chainId, "0x4A584E33Dec216a124E36Aceb0B06Bc37642027B"]);
}

async function main() {
    let env = await getEnv(false);
    await deployCuration(env)
}

main()
    .catch(console.error)
    .finally(() => process.exit());