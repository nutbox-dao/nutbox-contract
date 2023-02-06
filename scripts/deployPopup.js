require('dotenv').config();
const ethers = require('ethers');
const { getEnv, waitForTx, deployContract } = require('./utils');

const erc20Json = require('../build/contracts/ERC20PresetMinterPauser.json')
const PopupJson = require('../build/contracts/Popup.json');

async function deployPopupContract(env) {
    await deployContract(env, PopupJson);
}

async function deployTokenContract(env, name, symbol) {
    let factory = new ethers.ContractFactory(erc20Json.abi, erc20Json.bytecode, env.wallet);
    let contract = await factory.deploy(
        name,
        symbol,
        { gasPrice: env.gasPrice }
    );
    await contract.deployed();
    console.log("✓ ERC20 contract deployed:", name, contract.address);
    return contract.address;
}

async function main() {
    let env = await getEnv(false);
    await deployPopupContract(env)
    if (env.url == process.env.LOCAL_RPC) {
        await deployTokenContract(env, "TEST", "TEST");
    }
}

main()
    .catch(console.error)
    .finally(() => process.exit());