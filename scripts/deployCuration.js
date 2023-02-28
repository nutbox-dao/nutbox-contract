require('dotenv').config();
// const ethers = require('ethers');
const { getEnv, deployContract } = require('./utils');

const CurationJson = require('../build/contracts/Curation.json');
const ERC20 = require("../build/contracts/ERC20PresetMinterPauser.json");

async function deployCuration(env) {
    // let factory = new ethers.ContractFactory(CurationJson.abi, CurationJson.bytecode, env.wallet);
    // let gasPrice = env.gasPrice;
    // let contract = await factory.deploy(env.chainId, "0x4A584E33Dec216a124E36Aceb0B06Bc37642027B", { gasPrice });
    // await contract.deployed();
    // console.log("✓ Curation contract deployed", contract.address);

    await deployContract(env, CurationJson, [env.chainId, "0x447f163b9c1B097dC5d5F44bE4d364672F4eE4d8"]);
}

async function main() {
    let env = await getEnv(false);

    await deployCuration(env)

    if (env.chainId == 1337) {
        await deployContract(env, ERC20, ["Test usdt", "USDT"]);
    }
}

main()
    .catch(console.error)
    .finally(() => process.exit());