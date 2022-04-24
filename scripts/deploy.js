
/** 
 * Walnut contract deploy script
 * run node deploy
 * 
 */
require('dotenv').config();
const ethers = require('ethers');
const fs = require("fs");
const { waitForTx } = require('./utils')

const CommitteeJson = require('../build/contracts/Committee.json')
const CommunityFactoryJson = require('../build/contracts/CommunityFactory.json')
const SPStakingFactoryJson = require('../build/contracts/SPStakingFactory.json')
const ERC20StakingFactoryJson = require('../build/contracts/ERC20StakingFactory.json')
const CrowdloanFactoryJson = require('../build/contracts/CrowdloanFactory.json')
const LinearCalculatorJson = require('../build/contracts/LinearCalculator.json')
const MintableERC20FactoryJson = require('../build/contracts/MintableERC20Factory.json')

// const NutAddress = '0x3a51Ac476B2505F386546450822F1bF9d881bEa4'  // local host
// const NutAddress = '0xc821eC39fd35E6c8414A6C7B32674D51aD0c2468'  // goerli
// const NutAddress = '0x871AD5aAA75C297EB22A6349871ce4588E3c0306' // bsc test  mbase
// const NutAddress = '0x4429FcdD4eC4EA4756B493e9c0525cBe747c2745'   // bsc mainnet
// const NutAddress = '0xd10e4C1e301A13A9B874bd1757c135Eda075769D'     // Astar
const NutAddress = '0xDb761E1506dCEedA6A0F5130d33BE7fB8d671c24'       // shibuya

async function deployCommitteeContract(env) {
    let factory = new ethers.ContractFactory(CommitteeJson.abi, CommitteeJson.bytecode, env.wallet);
    let contract = await factory.deploy(env.wallet.address, NutAddress, {
        gasPrice: env.gasPrice
    });
    await contract.deployed();
    console.log("✓ Committee contract deployed", contract.address);
    env.Committee = contract.address;
}

async function deployMintableERC20FactoryContract(env) {
    let factory = new ethers.ContractFactory(MintableERC20FactoryJson.abi, MintableERC20FactoryJson.bytecode, env.wallet);
    let contract = await factory.deploy({ gasPrice: env.gasPrice })
    await contract.deployed();
    console.log("✓ Simple Mintable ERC20 contract deployed", contract.address);
    env.MintableERC20Factory = contract.address;
}

async function deploySPStakingFactoryContract(env) {
    let factory = new ethers.ContractFactory(SPStakingFactoryJson.abi, SPStakingFactoryJson.bytecode, env.wallet);
    let contract = await factory.deploy(env.CommunityFactory, {
        gasPrice: env.gasPrice
    });
    await contract.deployed();
    console.log("✓ SPStakingFactory contract deployed", contract.address);
    env.SPStakingFactory = contract.address
}

async function deployCrowdloanFactoryContract(env) {
    let factory = new ethers.ContractFactory(CrowdloanFactoryJson.abi, CrowdloanFactoryJson.bytecode, env.wallet);
    let contract = await factory.deploy(env.CommunityFactory, {
        gasPrice: env.gasPrice
    });
    await contract.deployed();
    console.log("✓ CrowdloanFactoryJson contract deployed", contract.address);
    env.CrowdloanFactory = contract.address
}

async function deployERC20StakingFactoryContract(env) {
    let factory = new ethers.ContractFactory(ERC20StakingFactoryJson.abi, ERC20StakingFactoryJson.bytecode, env.wallet);
    let contract = await factory.deploy(env.CommunityFactory, {
        gasPrice: env.gasPrice
    });
    await contract.deployed();
    console.log("✓ ERC20StakingFactory contract deployed", contract.address);
    env.ERC20StakingFactory = contract.address
}

async function deployCommunityFactoryContract(env) {
    let factory = new ethers.ContractFactory(CommunityFactoryJson.abi, CommunityFactoryJson.bytecode, env.wallet);
    let contract = await factory.deploy(env.Committee, {
        gasPrice: env.gasPrice
    });
    await contract.deployed();
    env.CommunityFactory = contract.address;
    console.log("✓ CommunityFactory contract deployed", contract.address);
}

async function deployLinearCalculatorContract(env) {
    let factory = new ethers.ContractFactory(LinearCalculatorJson.abi, LinearCalculatorJson.bytecode, env.wallet);
    let contract = await factory.deploy(env.CommunityFactory, {
        gasPrice: env.gasPrice
    });
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
    env.gasPrice = await env.provider.getGasPrice();
    env.gasPrice = env.gasPrice * 1.2
    console.log(`private: ${env.privateKey}, url: ${env.url}`);

    let startBalance = await env.provider.getBalance(env.wallet.address);

    // env.Committee = '0x72d67B28E16f8629C4C9eAe3441369bb42460f26';
    // env.CommunityFactory = '0x8adAf21Ca4D170d0c12DD6501B80f3f97DB158C3'
    // env.SPStakingFactory = '0x228Bb17bCe5FC4d8212Bfa2Fe61e6CC6e1131772'
    // env.ERC20StakingFactory = '0xe8924F73a236439B2512f2Bb92EA8e7100b743BD'
    // env.LinearCalculator = '0x7281e39F77418356950A62BA944a79Db9310c69e'

    await deployCommitteeContract(env);
    await deployMintableERC20FactoryContract(env);
    await deployCommunityFactoryContract(env);
    // await deploySPStakingFactoryContract(env);
    await deployERC20StakingFactoryContract(env);
    await deployCrowdloanFactoryContract(env);
    await deployLinearCalculatorContract(env);
    let tx;

    const committeeContract = new ethers.Contract(env.Committee, CommitteeJson.abi, env.wallet)
    tx = await committeeContract.adminAddWhitelistManager(env.CommunityFactory);
    console.log('Admin set factory to committee whitelist');

    tx = await committeeContract.adminAddContract(env.MintableERC20Factory);
    console.log(`Admin register MintableERC20Factory`);
    tx = await committeeContract.adminAddContract(env.LinearCalculator);
    console.log(`Admin register linear calculator`);
    tx = await committeeContract.adminAddContract(env.CrowdloanFactory);
    console.log(`Admin register CrowdloanFactory`);
    tx = await committeeContract.adminAddContract(env.ERC20StakingFactory);
    console.log(`Admin register ERC20StakingFactory`);

    tx = await committeeContract.adminAddFeeFreeAddress(env.CrowdloanFactory);
    console.log(`Admin set address:${env.CrowdloanFactory} to fee free list`);
    
    const crowdloanFactoryContract = new ethers.Contract(env.CrowdloanFactory, CrowdloanFactoryJson.abi, env.wallet);
    tx = await crowdloanFactoryContract.adminSetBridge(0, env.wallet.address, true);
    tx = await crowdloanFactoryContract.adminSetBridge(1, env.wallet.address, true);
    tx = await crowdloanFactoryContract.adminSetBridge(2, env.wallet.address, true);
    console.log(`Admin set crowdloan bridge`);

    let deployCost = startBalance.sub((await env.provider.getBalance(env.wallet.address)))

    const blockNum = await env.provider.getBlockNumber();

    const output = {
        Committee: env.Committee ?? "Not Deployed",
        MintableERC20Factory: env.MintableERC20Factory ?? 'Not Deployed',
        CommunityFactory: env.CommunityFactory ?? "Not Deployed",
        LinearCalculator: env.LinearCalculator ?? "Not Deployed",
        ERC20StakingFactory: env.ERC20StakingFactory ?? 'Not Deployed',
        CrowdloanFactory: env.CrowdloanFactory ?? "Not Deployed"
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
        MintableERC20Factory: ${env.MintableERC20Factory ?? "Not Deployed"}
        ---------------------------------------------------------------
        CommunityFactory:       ${env.CommunityFactory ?? "Not Deployed"}
        ---------------------------------------------------------------
        LinearCalculator:       ${env.LinearCalculator ?? "Not Deployed"}
        ---------------------------------------------------------------
        CrowdloanFactory:       ${env.CrowdloanFactory ?? "Not Deployed"}
        ---------------------------------------------------------------
        ERC20StakingFactory:     ${env.ERC20StakingFactory ?? "Not Deployed"}
        ===============================================================
    `);
}

main()
    .catch(console.error)
    .finally(() => process.exit());