require('dotenv').config();
const ethers = require('ethers');
const { getEnv, waitForTx } = require('./utils');

const erc20Json = require('../build/contracts/ERC20PresetMinterPauser.json')
const PopupJson = require('../build/contracts/Popup.json');

async function deployPopupContract(env) {
    let factory = new ethers.ContractFactory(PopupJson.abi, PopupJson.bytecode, env.wallet);
    let gasPrice = env.gasPrice;
    let contract = await factory.deploy({ gasPrice });
    await contract.deployed();
    console.log("✓ Popup contract deployed", contract.address);
    let owner ="0xb850d021D8876a359FBFd34988d0C6A21A29edf9";
    await contract.transferOwnership(owner, { gasPrice });
    console.log(`✓ transferOwnership to ${owner}`);
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