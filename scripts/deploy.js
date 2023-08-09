
/** 
 * Walnut contract deploy script
 * run node deploy
 * 
 */
require('dotenv').config();
const fs = require("fs");
const { ethers, helpers } = require('hardhat');
const { waitForTx } = require('./utils')

// const NutAddress = '0x3a51Ac476B2505F386546450822F1bF9d881bEa4'  // local host
const NutAddress = '0x39ab47b7F6D2B6874157750440b4948786066283'  // Linea
// const NutAddress = '0x871AD5aAA75C297EB22A6349871ce4588E3c0306' // bsc test  mbase
// const NutAddress = '0x4429FcdD4eC4EA4756B493e9c0525cBe747c2745' // bsc
const deployer = '0x2DaE3A44D3C6e9Ab402f6e616ce1d02c1836A6Ac'

async function deployCommitteeContract(env) {
    const factory = await ethers.getContractFactory('Committee');
    const contract = await factory.deploy(deployer, NutAddress);
    await contract.deployed();
    console.log('✓ Committee contract deployed:', contract.address);
    env.Committee = contract.address;
    return contract;
}

async function deployMintableERC20FactoryContract(env) {
    const factory = await ethers.getContractFactory('MintableERC20Factory');
    const contract = await factory.deploy();
    await contract.deployed();
    console.log('✓ Mintable ERC20 contract deployed', contract.address);
    env.MintableERC20Factory = contract.address;
    return contract;

}

async function deployNutPowerContract(env) {
    const factory = await ethers.getContractFactory('NutPower');
    const contract = await factory.deploy(NutAddress);
    await contract.deployed();
    console.log('✓ NutPower contract deployed', contract.address);
    env.NutPower = contract.address;
    return contract;
}

async function deploySPStakingFactoryContract(env) {
    const factory = await ethers.getContractFactory('SPStakingFactory');
    const contract = await factory.deploy(env.CommunityFactory);
    await contract.deployed();
    console.log('✓ SPStakingFactory contract deployed', contract.address);
    env.SPStakingFactory = contract.address;
    return contract;
}

async function deployERC20StakingFactoryContract(env) {
    const factory = await ethers.getContractFactory('ERC20StakingFactory');
    const contract = await factory.deploy(env.CommunityFactory);
    await contract.deployed();
    console.log('✓ ERC20StakingFactory contract deployed', contract.address);
    env.ERC20StakingFactory = contract.address;
    return contract;
}

async function deployERC1155StakingFactoryContract(env) {
    const factory = await ethers.getContractFactory('ERC1155StakingFactory');
    const contract = await factory.deploy(env.CommunityFactory);
    await contract.deployed();
    console.log('✓ ERC1155StakingFactory contract deployed', contract.address);
    env.ERC1155StakingFactory = contract.address;
    return contract;
}

async function deployCosmosStakingFactoryContract(env) {
    const factory = await ethers.getContractFactory('CosmosStakingFactory');
    const contract = await factory.deploy(env.CommunityFactory);
    await contract.deployed();
    console.log('✓ CosmosStakingFactory contract deployed', contract.address);
    env.CosmosStakingFactory = contract.address;
    return contract;
}

async function deployCommunityFactoryContract(env) {
    const factory = await ethers.getContractFactory('CommunityFactory');
    const contract = await factory.deploy(env.Committee);
    await contract.deployed();
    console.log('✓ CommunityFactory contract deployed', contract.address);
    env.CommunityFactory = contract.address;
    return contract;
}

async function deployGaugeContract(env) {
    const factory = await ethers.getContractFactory('Gauge');
    const contract = await factory.deploy(env.CommunityFactory, 0, {
        community: 5000,
        poolFactory: 0,
        user: 5000
    }, env.NutPower, NutAddress);
    await contract.deployed();
    console.log('✓ Gauge contract deployed', contract.address);
    env.Gauge = contract.address;
    return contract;
}

async function deployLinearCalculatorContract(env) {
    const factory = await ethers.getContractFactory('LinearCalculator');
    const contract = await factory.deploy(env.CommunityFactory);
    await contract.deployed();
    console.log('✓ LinearCalculator contract deployed', contract.address);
    env.LinearCalculator = contract.address;
    return contract;
}

async function deployTreasuryFactoryContract(env) {
    const factory = await ethers.getContractFactory('TreasuryFactory');
    const contract = await factory.deploy(env.CommunityFactory);
    await contract.deployed();
    console.log('✓ TreasuryFactory contract deployed', contract.address);
    env.TreasuryFactory = contract.address;
    return contract;
}

async function main() {
    let env = {}
    env.url = process.env.MAIN_RPC;
    env.privateKey = process.env.MAIN_KEY;
    env.provider = new ethers.providers.JsonRpcProvider(env.url);
    env.wallet = new ethers.Wallet(env.privateKey, env.provider);
    env.gasPrice = await env.provider.getGasPrice();
    // env.gasPrice = env.gasPrice * 1.5
    console.log(`private: ${env.privateKey}, url: ${env.url}`);

    let startBalance = await env.provider.getBalance(deployer);

    const signer = env.wallet;

    env.Committee = '0x24B2c677575286993Be95147B4896d83cE02Dc4e';
    env.MintableERC20Factory = '0x183434ba0726b244521cB1C46AE5C90538146db8';
    env.NutPower = '0xFe992EF5f73Ac289052F1742B918278a62686fD1'
    env.CommunityFactory = '0x420E3b63F2587702B0BCdc50aF948cF387515593'
    env.SPStakingFactory = '0x20ABc409b7dc7a6DC8cC1309A5A7DBb5B1c0D014'
    env.CosmosStakingFactory = '0x5A95D35579C3aaF7F1df86540286A9DD90506F00'
    env.ERC20StakingFactory = '0x8d7F753D3b3862169d9eee500de3F7220103eAAd'
    env.ERC1155StakingFacory = '0xf6DDd65295Ca7A672C34043aa62f32C01FBfb29D'
    env.LinearCalculator = '0xF21649D901A082772Bd7B5d5eD5039C7a43A5789'
    env.Gauge = '0x97e9ca88Eb99bAA07d15B8aB846c53886FDB2f74'
    env.TreasuryFactory = '0xb05C38625f7F8CCab519421E5263f164D8F431f2'

    // const Committee = await deployCommitteeContract(env);
    // const MintableERC20Factory = await deployMintableERC20FactoryContract(env);
    // const NutPower = await deployNutPowerContract(env);

    const Committee = await ethers.getContractAt("Committee", env.Committee, signer);
    const NutPower = await ethers.getContractAt('NutPower', env.NutPower, signer);

    // const CommunityFactory = await deployCommunityFactoryContract(env);
    // const SPStakingFactory = await deploySPStakingFactoryContract(env);
    const SPStakingFactory = await ethers.getContractAt('SPStakingFactory', env.SPStakingFactory, signer);
    // const CosmosStakingFactory =  await deployCosmosStakingFactoryContract(env);
    // const ERC20StakingFactory = await deployERC20StakingFactoryContract(env);
    // const ERC1155StakingFacory = await deployERC1155StakingFactoryContract(env);
    // const LinearCalculator = await deployLinearCalculatorContract(env);
    // const Gauge = await deployGaugeContract(env);
    // const TreasuryFactory = await deployTreasuryFactoryContract(env);
    const Gauge = await ethers.getContractAt('Gauge', env.Gauge, signer);


    let tx;

    tx = await Committee.adminAddWhitelistManager(env.CommunityFactory);
    await waitForTx(env.provider, tx.hash)
    console.log('Admin set factory to committee whitelist');

    // committee set contracts whitelist
    tx = await Committee.adminAddContract(env.MintableERC20Factory);
    await waitForTx(env.provider, tx.hash)
    console.log(`Admin register MintableERC20Factory`);
    tx = await Committee.adminAddContract(env.LinearCalculator);
    await waitForTx(env.provider, tx.hash)
    console.log(`Admin register linear calculator`);
    tx = await Committee.adminAddContract(env.SPStakingFactory);
    await waitForTx(env.provider, tx.hash)
    console.log(`Admin register SPStakingFactory`);
    tx = await Committee.adminAddContract(env.ERC20StakingFactory);
    await waitForTx(env.provider, tx.hash)
    console.log(`Admin register ERC20StakingFactory`);
    tx = await Committee.adminAddContract(env.CosmosStakingFactory);
    await waitForTx(env.provider, tx.hash)
    console.log(`Admin register CosmosStakingFactory`);

    // set Gauge to committee
    tx = await Committee.adminSetGauge(env.Gauge);
    await waitForTx(env.provider, tx.hash)
    console.log(`Admin register Gauge`);

    // committee set fee free list
    tx = await Committee.adminAddFeeFreeAddress(env.SPStakingFactory);
    await waitForTx(env.provider, tx.hash)
    console.log(`Admin set address:${env.SPStakingFactory} to fee free list`);
    tx = await Committee.adminAddFeeFreeAddress(env.CosmosStakingFactory);
    await waitForTx(env.provider, tx.hash)
    console.log(`Admin set address:${env.CosmosStakingFactory} to fee free list`);

    // staking factory set bridge
    tx = await SPStakingFactory.adminSetBridge(deployer);
    await waitForTx(env.provider, tx.hash)
    console.log(`Admin set sp staking bridge`);
    // const cosmosStakingFactoryContract = new ethers.Contract(env.CosmosStakingFactory, CosmosStakingFactoryJson.abi, env.wallet);
    // tx = await cosmosStakingFactoryContract.adminAddBridge(1, deployer);  // steem
    // tx = await cosmosStakingFactoryContract.adminAddBridge(2, deployer);  // hive
    // tx = await cosmosStakingFactoryContract.adminAddBridge(3, '0xAF35c6452B3DD42dCc2AF8BF9689484bF27Aa143');  // Tien's address
    // tx = await cosmosStakingFactoryContract.adminAddBridge(1, '0xD9f4985a73349dea9aCB7c424E35056714bA2B35');  // Boy's address
    // tx = await cosmosStakingFactoryContract.adminAddBridge(3, "0x8c4C0Ec6d30A7B3f81E4F70a46b3c8B44B99470D");  // atom
    // tx = await cosmosStakingFactoryContract.adminAddBridge(4, "0xFa41CfdaAf9ae7f3a72d86229FBE428bb186A305");  // osmo
    // tx = await cosmosStakingFactoryContract.adminAddBridge(5, "0x6587FD7f5Dd9D0EbC13bf5C9CEfCf675a11d351f");  // juno
    // console.log(`Admin set cosmos staking bridge`);

    // set gauge to np
    tx = await NutPower.adminSetWhitelist(env.Gauge, true);
    await waitForTx(env.provider, tx.hash)
    console.log('Admin set gauge to nut power', tx.hash);

    // set gauge param
    tx = await Gauge.adminSetRewardNUTPerBlock(ethers.utils.parseUnits('2.5', 18))
    await waitForTx(env.provider, tx.hash)
    console.log('Admin set gauge distribution to 2.5 nut per block');

    // transfer ownership to committee
    // tx = await cosmosStakingFactoryContract.transferOwnership('0x5882f4422a5b897Aa05204a66b25303A7A62021f')
    // console.log('Transfer cosmos staking factory ownership to committee', tx.hash);
    // tx = await NutPower.transferOwnership('0x5882f4422a5b897Aa05204a66b25303A7A62021f')
    // console.log('Transfer np ownership to committee', tx.hash);
    // tx = await gauge.transferOwnership('0x5882f4422a5b897Aa05204a66b25303A7A62021f')
    // console.log('Transfer gauge ownership to committee', tx.hash);

    // set transaction fee
    tx = await Committee.adminSetFee(
        'COMMUNITY', 
        0);
    await waitForTx(env.provider, tx.hash)
    console.log('admin set community fee:', tx.hash)
    tx = await Committee.adminSetFee(
        'USER', 
        0);
    await waitForTx(env.provider, tx.hash)
    console.log('admin set user fee', tx.hash)

    // console.log(`Admin set fees`);

    let deployCost = startBalance.sub((await env.provider.getBalance(deployer)))

    const blockNum = await env.provider.getBlockNumber();

    const output = {
        Committee: env.Committee ?? "Not Deployed",
        MintableERC20Factory: env.MintableERC20Factory ?? 'Not Deployed',
        NutPower: env.NutPower ?? 'Not Depoloyed',
        CommunityFactory: env.CommunityFactory ?? "Not Deployed",
        LinearCalculator: env.LinearCalculator ?? "Not Deployed",
        SPStakingFactory: env.SPStakingFactory ?? 'Not Deployed',
        ERC20StakingFactory: env.ERC20StakingFactory ?? "Not Deployed",
        ERC1155StakingFacory: env.ERC1155StakingFactory ?? "Not Depolyed",
        CosmosStakingFactory: env.CosmosStakingFactory ?? "Not Deployed",
        Gauge:  env.Gauge ?? 'Not deployed',
        TreasuryFactory: env.TreasuryFactory ?? "Not deployed"
    }

    const outfile = "./scripts/contracts.json";
    const jsonStr = JSON.stringify(output, undefined, 2);
    fs.writeFileSync(outfile, jsonStr, { encoding: "utf-8" });
    
    console.log(`
        ===============================================================
        Url:            ${env.url}
        Deployer:       ${deployer}
        Depoly Cost:    ${ethers.utils.formatEther(deployCost)}
        Depoly block number: ${blockNum}

        Contract Addresses:
        ===============================================================
        Committee:              ${env.Committee ?? "Not Deployed"}
        ---------------------------------------------------------------
        MintableERC20Factory:   ${env.MintableERC20Factory ?? "Not Deployed"}
        ---------------------------------------------------------------
        NutPower:               ${env.NutPower ?? "Not Deployed"}
        ---------------------------------------------------------------
        CommunityFactory:       ${env.CommunityFactory ?? "Not Deployed"}
        ---------------------------------------------------------------
        LinearCalculator:       ${env.LinearCalculator ?? "Not Deployed"}
        ---------------------------------------------------------------
        SPStakingFactory:       ${env.SPStakingFactory ?? "Not Deployed"}
        ---------------------------------------------------------------
        ERC20StakingFactory:    ${env.ERC20StakingFactory ?? "Not Deployed"}
        ---------------------------------------------------------------
        ERC1155StakingFactory:  ${env.ERC1155StakingFactory ?? "Not Deployed"}
        ---------------------------------------------------------------
        CosmosStakingFactory:   ${env.CosmosStakingFactory ?? "Not Deployed"}
        ---------------------------------------------------------------
        Gauge:                  ${env.Gauge ?? "Not Deployed"}
        ---------------------------------------------------------------
        TreasuryFactory:        ${env.TreasuryFactory ?? "Not Deployed"}
        ===============================================================
    `);
}

main()
    .catch(console.error)
    .finally(() => process.exit());