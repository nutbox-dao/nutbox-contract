
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
const ETHStakingFactoryJson = require('../build/contracts/ETHStakingFactory.json')
const ERC1155StakingFactoryJson = require('../build/contracts/ERC1155StakingFactory.json')
const CosmosStakingFactoryJson = require('../build/contracts/CosmosStakingFactory.json')
const LinearCalculatorJson = require('../build/contracts/LinearCalculator.json')
const MintableERC20FactoryJson = require('../build/contracts/MintableERC20Factory.json')
const NutPowerJson = require('../build/contracts/NutPower.json')
const GaugeJson = require('../build/contracts/Gauge.json');
const TreasuryFactoryJson = require('../build/contracts/TreasuryFactory.json')
const { log } = require('console');
const { env } = require('process');

// const NutAddress = '0x3a51Ac476B2505F386546450822F1bF9d881bEa4'  // local host
// const NutAddress = '0xc821eC39fd35E6c8414A6C7B32674D51aD0c2468'  // goerli
// const NutAddress = '0x871AD5aAA75C297EB22A6349871ce4588E3c0306' // bsc test  mbase
// const NutAddress = '0x4429FcdD4eC4EA4756B493e9c0525cBe747c2745' // bsc
const NutAddress = '0xED4D88303973615cC3D61D5F4D06A809055a07b8'; // arbitrum

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

async function deployETHStakingFactoryContract(env) {
    let factory = new ethers.ContractFactory(ETHStakingFactoryJson.abi, ETHStakingFactoryJson.bytecode, env.wallet);
    let contract = await factory.deploy(env.CommunityFactory, {
        gasPrice: env.gasPrice
    });
    await contract.deployed();
    console.log("✓ ETHStakingFactory contract deployed", contract.address)
    env.ETHStakingFactory = contract.address
}

async function deployERC1155StakingFactoryContract(env) {
    let factory = new ethers.ContractFactory(ERC1155StakingFactoryJson.abi, ERC1155StakingFactoryJson.bytecode, env.wallet);
    let contract = await factory.deploy(env.CommunityFactory, {
        gasPrice: env.gasPrice
    });
    await contract.deployed();
    console.log("✓ ERC1155StakingFactory contract deployed", contract.address);
    env.ERC1155StakingFactory = contract.address
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
    let contract = await factory.deploy(env.CommunityFactory, 1000, {
        community: 5000,
        poolFactory: 0,
        user: 5000
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

async function deployTreasuryFactoryContract(env) {
    let factory = new ethers.ContractFactory(TreasuryFactoryJson.abi, TreasuryFactoryJson.bytecode, env.wallet)
    let contract = await factory.deploy(env.CommunityFactory, {
        gasPrice: env.gasPrice
    });
    await contract.deployed();
    env.TreasuryFactory = contract.address;
    console.log("✓ TreasuryFactory contract deployed", contract.address);
}

async function main() {
    let env = {}
    env.url = process.env.ENDPOINT;
    env.privateKey = process.env.KEY;
    env.provider = new ethers.providers.JsonRpcProvider(env.url);
    env.wallet = new ethers.Wallet(env.privateKey, env.provider);
    env.gasPrice = await env.provider.getGasPrice();
    // env.gasPrice = env.gasPrice * 1.5
    console.log(`private: ${env.privateKey}, url: ${env.url}`);

    let startBalance = await env.provider.getBalance(env.wallet.address);

    // env.Committee = '0x4C5e687CE5a365ce7bE9E536cf617D3D08Aadde3';
    // env.MintableERC20Factory = '0x1320A00303435250c23F06E3a2383a6c1174C9FB';
    // env.NutPower = '0x7e109A3a696367c0527E15eDb815F549E637C39b'
    // env.CommunityFactory = '0xDB1d3a43B19d0E95EE4fA16486350434A15e8c86'
    // env.SPStakingFactory = '0x37921DB31E88e80AC43fD285AE60230065b9E87C'
    // env.CosmosStakingFactory = '0x8Ea8870001216429f72CEA80fEE576dfe883E5bD'
    // env.ERC20StakingFactory = '0x7Be1085298446c041f72db9f50cd3953638B023a'
    // env.ERC1155StakingFactory = '0xBab99d73D20DE32D0f674dA58390b4C904654C19'
    // env.LinearCalculator = '0xa3e53F30C9cc6d174a98b311676e026535326f42'
    // env.Gauge = '0x57A9D7630CC5Fd5000EE93D66b1Db121B9785832'

    await deployCommitteeContract(env);
    await deployMintableERC20FactoryContract(env);
    await deployNutPowerContract(env);
    await deployCommunityFactoryContract(env);
    // await deploySPStakingFactoryContract(env);
    // await deployCosmosStakingFactoryContract(env);
    await deployERC20StakingFactoryContract(env);
    await deployETHStakingFactoryContract(env);
    // await deployERC1155StakingFactoryContract(env);
    await deployLinearCalculatorContract(env);
    await deployGaugeContract(env);
    // await deployTreasuryFactoryContract(env);
    let tx;
    // const treasuryFactory = new ethers.Contract("0x8428aD36744a9917112c2A9a40C4f48FCF80e39E", TreasuryFactoryJson.abi, env.wallet);
    // const eth = "0x3F3BFe3b0363c3e0a713C0Ce338DbFd31b987581"
    // const cake = "0x9574e5728E4Ea28d832E12d4d1a80225DD93B689"
    // const ts = '0x33B78D217F271Ecb3DA1bB61F9ABB7d49425dd14'
    // const pnut = '0x9187C7B1284F6583aD960eB2b7074a0df563E346'
    // const atom = '0xf0D4597E13715b372497EeaC05a0e9aa5b10f929'
    // const steem = '0xC07FA2B98f8BE846da87e3F03dB1A77dBd4b4485'
    // tx = await treasuryFactory.adminAddReward(atom)
    // await waitForTx(env.provider, tx.hash)
    // tx = await treasuryFactory.adminAddReward(steem)
    // await waitForTx(env.provider, tx.hash)
    // tx = await treasuryFactory.adminRemoveReward(eth)
    // await waitForTx(env.provider, tx.hash)
    // tx = await treasuryFactory.adminRemoveReward(cake)
    // await waitForTx(env.provider, tx.hash)
    // tx = await treasuryFactory.adminRemoveReward(ts)
    // await waitForTx(env.provider, tx.hash)
    // tx = await treasuryFactory.adminRemoveReward(pnut)
    // await waitForTx(env.provider, tx.hash)
    // return;

    const committeeContract = new ethers.Contract(env.Committee, CommitteeJson.abi, env.wallet)

    tx = await committeeContract.adminAddWhitelistManager(env.CommunityFactory);
    console.log('Admin set factory to committee whitelist');

    // committee set contracts whitelist
    tx = await committeeContract.adminAddContract(env.MintableERC20Factory);
    console.log(`Admin register MintableERC20Factory`);
    tx = await committeeContract.adminAddContract(env.LinearCalculator);
    console.log(`Admin register linear calculator`);
    // tx = await committeeContract.adminAddContract(env.SPStakingFactory);
    // console.log(`Admin register SPStakingFactory`);
    tx = await committeeContract.adminAddContract(env.ERC20StakingFactory);
    console.log(`Admin register ERC20StakingFactory`);
    tx = await committeeContract.adminAddContract(env.ETHStakingFactory);
    console.log(`Admin register ETHStakingFactory`);
    // tx = await committeeContract.adminAddContract(env.CosmosStakingFactory);
    // console.log(`Admin register CosmosStakingFactory`);

    // set Gauge to committee
    tx = await committeeContract.adminSetGauge(env.Gauge);
    console.log(`Admin register Gauge`);

    // committee set fee free list
    // tx = await committeeContract.adminAddFeeFreeAddress(env.SPStakingFactory);
    // console.log(`Admin set address:${env.SPStakingFactory} to fee free list`);
    // tx = await committeeContract.adminAddFeeFreeAddress(env.CosmosStakingFactory);
    // console.log(`Admin set address:${env.CosmosStakingFactory} to fee free list`);

    // staking factory set bridge
    // const sPStakingFactoryContract = new ethers.Contract(env.SPStakingFactory, SPStakingFactoryJson.abi, env.wallet);
    // tx = await sPStakingFactoryContract.adminSetBridge(env.wallet.address);
    // console.log(`Admin set sp staking bridge`);
    // const cosmosStakingFactoryContract = new ethers.Contract(env.CosmosStakingFactory, CosmosStakingFactoryJson.abi, env.wallet);
    // tx = await cosmosStakingFactoryContract.adminAddBridge(1, env.wallet.address);  // steem
    // tx = await cosmosStakingFactoryContract.adminAddBridge(2, env.wallet.address);  // hive
    // tx = await cosmosStakingFactoryContract.adminAddBridge(3, '0xAF35c6452B3DD42dCc2AF8BF9689484bF27Aa143');  // Tien's address
    // tx = await cosmosStakingFactoryContract.adminAddBridge(1, '0xD9f4985a73349dea9aCB7c424E35056714bA2B35');  // Boy's address
    // tx = await cosmosStakingFactoryContract.adminAddBridge(3, "0x8c4C0Ec6d30A7B3f81E4F70a46b3c8B44B99470D");  // atom
    // tx = await cosmosStakingFactoryContract.adminAddBridge(4, "0xFa41CfdaAf9ae7f3a72d86229FBE428bb186A305");  // osmo
    // tx = await cosmosStakingFactoryContract.adminAddBridge(5, "0x6587FD7f5Dd9D0EbC13bf5C9CEfCf675a11d351f");  // juno
    // console.log(`Admin set cosmos staking bridge`);

    // set gauge to np
    const nutPowerContract = new ethers.Contract(env.NutPower, NutPowerJson.abi, env.wallet);
    tx = await nutPowerContract.adminSetWhitelist(env.Gauge, true);
    console.log('Admin set gauge to nut power');

    // set gauge param
    const gauge = new ethers.Contract(env.Gauge, GaugeJson.abi, env.wallet)
    tx = await gauge.adminSetRewardNUTPerBlock(ethers.utils.parseUnits('0', 18))
    console.log('Admin set gauge distribution to 0 nut per block');

    // transfer ownership to committee
    // tx = await cosmosStakingFactoryContract.transferOwnership(env.Committee)
    // console.log('Transfer cosmos staking factory ownership to committee', tx.hash);
    tx = await nutPowerContract.transferOwnership(env.Committee)
    console.log('Transfer np ownership to committee', tx.hash);
    tx = await gauge.transferOwnership(env.Committee)
    console.log('Transfer gauge ownership to committee', tx.hash);

    // set transaction fee
    tx = await committeeContract.adminSetFee(
        'COMMUNITY', 
        ethers.utils.parseUnits('0', 18));
    tx = await committeeContract.adminSetFee(
        'USER', 
        ethers.utils.parseUnits('0', 18));

    console.log(`Admin set fees`);

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
        ERC1155StakingFactory: env.ERC1155StakingFactory ?? "Not Depolyed",
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
        Deployer:       ${env.wallet.address}
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