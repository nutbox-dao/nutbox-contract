
require('dotenv').config();
const ethers = require('ethers');
const fs = require("fs");
const { waitForTx } = require('./utils')

const CommitteeJson = require('../build/contracts/Committee.json')
const CommunityFactoryJson = require('../build/contracts/CommunityFactory.json')
const SPStakingFactoryJson = require('../build/contracts/SPStakingFactory.json')
const ERC20StakingFactoryJson = require('../build/contracts/ERC20StakingFactory.json')
const LinearCalculatorJson = require('../build/contracts/LinearCalculator.json')

// const NutAddress = '0x926E99b548e5D48Ca4C6215878b954ABd0f5D1f6'  // local host
const NutAddress = '0xc821eC39fd35E6c8414A6C7B32674D51aD0c2468'  // goerli

async function deployCommitteeContract(env) {
    let factory = new ethers.ContractFactory(CommitteeJson.abi, CommitteeJson.bytecode, env.wallet);
    let contract = await factory.deploy(env.wallet.address, NutAddress);
    await contract.deployed();
    console.log("✓ Committee contract deployed", contract.address);
    env.Committee = contract.address;
}

async function deploySPStakingFactoryContract(env) {
    let factory = new ethers.ContractFactory(SPStakingFactoryJson.abi, SPStakingFactoryJson.bytecode, env.wallet);
    let contract = await factory.deploy();
    await contract.deployed();
    console.log("✓ SPStakingFactory contract deployed", contract.address);
    env.SPStakingFactory = contract.address
}

async function deployERC20StakingFactoryContract(env) {
    let factory = new ethers.ContractFactory(ERC20StakingFactoryJson.abi, ERC20StakingFactoryJson.bytecode, env.wallet);
    let contract = await factory.deploy();
    await contract.deployed();
    console.log("✓ ERC20StakingFactory contract deployed", contract.address);
    env.ERC20StakingFactory = contract.address
}

async function deployCommunityFactoryContract(env) {
    let factory = new ethers.ContractFactory(CommunityFactoryJson.abi, CommunityFactoryJson.bytecode, env.wallet);
    let contract = await factory.deploy(env.Committee);
    await contract.deployed();
    env.CommunityFactory = contract.address;
    console.log("✓ CommunityFactory contract deployed", contract.address);
}

async function deployLinearCalculatorContract(env) {
    let factory = new ethers.ContractFactory(LinearCalculatorJson.abi, LinearCalculatorJson.bytecode, env.wallet);
    let contract = await factory.deploy(env.CommunityFactory);
    await contract.deployed();
    env.LinearCalculator = contract.address;
    console.log("✓ LinearCalculator contract deployed", contract.address);
}

async function main() {
    let env = {}
    env.url = process.env.TESTENDPOINT;
    env.privateKey = process.env.TESTKEY;
    env.provider = new ethers.providers.JsonRpcProvider(env.url);
    env.wallet = new ethers.Wallet(env.privateKey, env.provider);

    let startBalance = await env.provider.getBalance(env.wallet.address);

    await deployCommitteeContract(env);
    await deployCommunityFactoryContract(env);
    await deploySPStakingFactoryContract(env);
    await deployERC20StakingFactoryContract(env);
    await deployLinearCalculatorContract(env);

    const committeeContract = new ethers.Contract(env.Committee, CommitteeJson.abi, env.wallet)
    let tx = await committeeContract.adminAddWhitelistManager(env.CommunityFactory);
    console.log('Admin set factory to committee whitelist');

    tx = await committeeContract.adminAddContract(env.LinearCalculator);
    console.log(`Admin register linear calculator`);
    tx = await committeeContract.adminAddContract(env.SPStakingFactory);
    console.log(`Admin register SPStakingFactory`);
    tx = await committeeContract.adminAddContract(env.ERC20StakingFactory);
    console.log(`Admin register ERC20StakingFactory`);
    tx = await committeeContract.adminAddFeeIgnoreAddress(env.SPStakingFactory);
    console.log(`Admin set address:${env.SPStakingFactory} to fee ignore list`);

    const sPStakingFactoryContract = new ethers.Contract(env.SPStakingFactory, SPStakingFactoryJson.abi, env.wallet);
    tx = await sPStakingFactoryContract.adminSetBridge(env.wallet.address);
    console.log(`Admin set sp staking bridge`);

    let deployCost = startBalance.sub((await env.provider.getBalance(env.wallet.address)))

    const blockNum = await env.provider.getBlockNumber();

    const output = {
        Committee: env.Committee ?? "Not Deployed",
        CommunityFactory: env.CommunityFactory ?? "Not Deployed",
        LinearCalculator: env.LinearCalculator ?? "Not Deployed",
        SPStakingFactory: env.SPStakingFactory ?? 'Not Deployed',
        ERC20StakingFactory: env.ERC20StakingFactory ?? "Not Deployed"
    }

    const outfile = "./scripts/contracts.json";
    const jsonStr = JSON.stringify(output, undefined, 2);
    fs.writeFileSync(outfile, jsonStr, { encoding: "utf-8" });
    
    console.log(`
        ===============================================================
        Url:            ${env.url}
        Deployer:       ${env.wallet.address}
        Depoly Cost:    ${ethers.utils.formatEther(deployCost)}
        Depoly block number: ${blockNum}

        Contract Addresses:
        ===============================================================
        Committee:              ${env.Committee ?? "Not Deployed"}
        ---------------------------------------------------------------
        CommunityFactory:       ${env.CommunityFactory ?? "Not Deployed"}
        ---------------------------------------------------------------
        LinearCalculator:       ${env.LinearCalculator ?? "Not Deployed"}
        ---------------------------------------------------------------
        SPStakingFactory:       ${env.SPStakingFactory ?? "Not Deployed"}
        ---------------------------------------------------------------
        ERC20StakingFactory:     ${env.ERC20StakingFactory ?? "Not Deployed"}
        ===============================================================
    `);
}

main()
    .catch(console.error)
    .finally(() => process.exit());