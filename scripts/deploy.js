
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
const CosmosStakingFactoryJson = require('../build/contracts/CosmosStakingFactory.json')
const LinearCalculatorJson = require('../build/contracts/LinearCalculator.json')
const MintableERC20FactoryJson = require('../build/contracts/MintableERC20Factory.json')
const NutPowerJson = require('../build/contracts/NutPower.json')
const GaugeJson = require('../build/contracts/Gauge.json')

// const NutAddress = '0x3a51Ac476B2505F386546450822F1bF9d881bEa4'  // local host
const NutAddress = '0xc821eC39fd35E6c8414A6C7B32674D51aD0c2468'  // goerli
// const NutAddress = '0x871AD5aAA75C297EB22A6349871ce4588E3c0306' // bsc test  mbase

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
    console.log("✓ Mintable ERC20 contract deployed", contract.address);
    env.MintableERC20Factory = contract.address;
}

async function deployNutPowerContract(env) {
    let factory = new ethers.ContractFactory(NutPowerJson.abi, NutPowerJson.bytecode, env.wallet);
    let contract = await factory.deploy(NutAddress, { gasPrice: env.gasPrice });
    await contract.deployed();
    console.log("✓ Nut power contract deployed", contract.address);
    env.NutPower = contract.address;
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

async function deployERC20StakingFactoryContract(env) {
    let factory = new ethers.ContractFactory(ERC20StakingFactoryJson.abi, ERC20StakingFactoryJson.bytecode, env.wallet);
    let contract = await factory.deploy(env.CommunityFactory, {
        gasPrice: env.gasPrice
    });
    await contract.deployed();
    console.log("✓ ERC20StakingFactory contract deployed", contract.address);
    env.ERC20StakingFactory = contract.address
}

async function deployCosmosStakingFactoryContract(env) {
    let factory = new ethers.ContractFactory(CosmosStakingFactoryJson.abi, CosmosStakingFactoryJson.bytecode, env.wallet);
    let contract = await factory.deploy(env.CommunityFactory, {
        gasPrice: env.gasPrice
    });
    await contract.deployed();
    console.log("✓ CosmosStakingFactory contract deployed", contract.address);
    env.CosmosStakingFactory = contract.address
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

async function deployGaugeContract(env) {
    let factory = new ethers.ContractFactory(GaugeJson.abi, GaugeJson.bytecode, env.wallet);
    let contract = await factory.deploy(env.CommunityFactory, 100, {
        community: 3500,
        poolFactory: 0,
        user: 6500
    }, env.NutPower, NutAddress, {gasPrice: env.gasPrice})
    await contract.deployed();
    env.Gauge = contract.address;
    console.log("✓ Gauge contract deployed", contract.address);
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
    // env.gasPrice = env.gasPrice * 1.5
    console.log(`private: ${env.privateKey}, url: ${env.url}`);

    let startBalance = await env.provider.getBalance(env.wallet.address);

    env.Committee = '0x116C1F8c11c041F5e095B35593cD28C438410096';
    env.MintableERC20Factory = '0xD8dd76efe29bA2f38b24b8D2EAF23F500b8c95d6';
    env.NutPower = '0xD34E7904a1676aF14266321d07fcFA585Ddc08aF'
    env.CommunityFactory = '0x15a0055165Fa2d2b64758380FbF8FaF8f016F422'
    env.SPStakingFactory = '0x0C1B497295925F2a8985B5834554C87B5BB5D9C1'
    env.CosmosStakingFactory = '0xf6ecAAd3F991C911253FB887f9d68B9DD41429B0'
    env.ERC20StakingFactory = '0x1BcAf6B35521ac89259d5625B1BfBc157fbd034E'
    env.LinearCalculator = '0xA287ef9a4AEFf4A30A173F93B90cc98766B0251c'

    // await deployCommitteeContract(env);
    // await deployMintableERC20FactoryContract(env);
    // await deployNutPowerContract(env);
    // await deployCommunityFactoryContract(env);
    // await deploySPStakingFactoryContract(env);
    // await deployCosmosStakingFactoryContract(env);
    // await deployERC20StakingFactoryContract(env);
    // await deployLinearCalculatorContract(env);
    await deployGaugeContract(env);
    let tx;

    const committeeContract = new ethers.Contract(env.Committee, CommitteeJson.abi, env.wallet)
    tx = await committeeContract.adminAddWhitelistManager(env.CommunityFactory);
    console.log('Admin set factory to committee whitelist');

    // committee set contracts whitelist
    tx = await committeeContract.adminAddContract(env.MintableERC20Factory);
    console.log(`Admin register MintableERC20Factory`);
    tx = await committeeContract.adminAddContract(env.LinearCalculator);
    console.log(`Admin register linear calculator`);
    tx = await committeeContract.adminAddContract(env.SPStakingFactory);
    console.log(`Admin register SPStakingFactory`);
    tx = await committeeContract.adminAddContract(env.ERC20StakingFactory);
    console.log(`Admin register ERC20StakingFactory`);
    tx = await committeeContract.adminAddContract(env.CosmosStakingFactory);
    console.log(`Admin register CosmosStakingFactory`);

    // set Gauge to committee
    tx = await committeeContract.adminSetGauge(env.Gauge);
    console.log(`Admin register Gauge`);

    // committee set fee free list
    tx = await committeeContract.adminAddFeeFreeAddress(env.SPStakingFactory);
    console.log(`Admin set address:${env.SPStakingFactory} to fee free list`);
    tx = await committeeContract.adminAddFeeFreeAddress(env.CosmosStakingFactory);
    console.log(`Admin set address:${env.CosmosStakingFactory} to fee free list`);

    // staking factory set bridge
    const sPStakingFactoryContract = new ethers.Contract(env.SPStakingFactory, SPStakingFactoryJson.abi, env.wallet);
    tx = await sPStakingFactoryContract.adminSetBridge(env.wallet.address);
    console.log(`Admin set sp staking bridge`);
    const cosmosStakingFactoryContract = new ethers.Contract(env.CosmosStakingFactory, CosmosStakingFactoryJson.abi, env.wallet);
    tx = await cosmosStakingFactoryContract.adminAddBridge(env.wallet.address);
    tx = await cosmosStakingFactoryContract.adminAddBridge('0xAF35c6452B3DD42dCc2AF8BF9689484bF27Aa143');  // Tien's address
    console.log(`Admin set cosmos staking bridge`);

    // set gauge to np
    const nutPowerContract = new ethers.Contract(env.NutPower, NutPowerJson.abi, env.wallet);
    tx = await nutPowerContract.adminSetGauge(env.Gauge);
    console.log('Admin set gauge to nut power');

    // set transaction fee
    // tx = await committeeContract.adminSetFee(
    //     'COMMUNITY', 
    //     ethers.utils.parseUnits('0.1', 18));
    // tx = await committeeContract.adminSetFee(
    //     'USER', 
    //     ethers.utils.parseUnits('0.01', 18));

    // console.log(`Admin set fees`);

    let deployCost = startBalance.sub((await env.provider.getBalance(env.wallet.address)))

    const blockNum = await env.provider.getBlockNumber();

    const output = {
        Committee: env.Committee ?? "Not Deployed",
        MintableERC20Factory: env.MintableERC20Factory ?? 'Not Deployed',
        NutPower: env.NutPower ?? 'Not Depoloyed',
        CommunityFactory: env.CommunityFactory ?? "Not Deployed",
        LinearCalculator: env.LinearCalculator ?? "Not Deployed",
        SPStakingFactory: env.SPStakingFactory ?? 'Not Deployed',
        ERC20StakingFactory: env.ERC20StakingFactory ?? "Not Deployed",
        CosmosStakingFactory: env.CosmosStakingFactory ?? "Not Deployed",
        Gauge:  env.Gauge ?? 'Not deployed'
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
        NutPower: ${env.NutPower ?? "Not Deployed"}
        ---------------------------------------------------------------
        CommunityFactory:       ${env.CommunityFactory ?? "Not Deployed"}
        ---------------------------------------------------------------
        LinearCalculator:       ${env.LinearCalculator ?? "Not Deployed"}
        ---------------------------------------------------------------
        SPStakingFactory:       ${env.SPStakingFactory ?? "Not Deployed"}
        ---------------------------------------------------------------
        ERC20StakingFactory:     ${env.ERC20StakingFactory ?? "Not Deployed"}
        ---------------------------------------------------------------
        CosmosStakingFactory:     ${env.CosmosStakingFactory ?? "Not Deployed"}
        ---------------------------------------------------------------
        Gauge: ${env.Gauge ?? "Not Deployed"}
        ===============================================================
    `);
}

main()
    .catch(console.error)
    .finally(() => process.exit());