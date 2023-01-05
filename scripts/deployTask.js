require('dotenv').config();
const ethers = require('ethers');
const { getEnv, waitForTx } = require('./utils');

const TaskJson = require('../build/contracts/Task.json');
const FundJson = require("../build/contracts/TaskWormholeFund.json");
const erc20Json = require('../build/contracts/ERC20PresetMinterPauser.json')

async function deployTaskContract(env) {
    let factory = new ethers.ContractFactory(TaskJson.abi, TaskJson.bytecode, env.wallet);
    let gasPrice = env.gasPrice;
    let contract = await factory.deploy({ gasPrice });
    await contract.deployed();
    console.log("✓ Task contract deployed", contract.address);

    // factory = new ethers.ContractFactory(FundJson.abi, FundJson.bytecode, env.wallet);
    // let fund = await factory.deploy({ gasPrice });
    // await fund.deployed();
    // console.log("✓ Fund contract deployed", fund.address);

    // let fund = new ethers.Contract("0x21975Ddd770DCf76480c5Bd045F0919C5E239c36", FundJson.abi, env.wallet);
    // let contract = new ethers.Contract("0x5D166D160a86A198c8634f9F9A22b8b6aE13ca18", TaskJson.abi, env.wallet);

    // await contract.setFundContract(fund.address, { gasPrice });
    // console.log("✓ Bind the fund address");
    let curationOwner = "0x36F18e8B735592dE9A32A417e482e106eAa0C77A"
    await contract.transferOwnership(curationOwner, { gasPrice });
    console.log(`✓ transferOwnership to ${curationOwner}`);

    // await fund.setTaskContract(contract.address, { gasPrice });
    // console.log("✓ Bind the task address");
    // let fundOwner = "0xb878F373FBe52198980938BF80E52c1A2E8d721e";
    // await fund.transferOwnership(fundOwner, { gasPrice });
    // console.log(`✓ transferOwnership to ${fundOwner}`);
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
    await deployTaskContract(env)
    if (env.url == process.env.LOCAL_RPC) {
        await deployTokenContract(env, "TEST", "TEST");
    }
}

main()
    .catch(console.error)
    .finally(() => process.exit());