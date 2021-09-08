// USAGE: 
//  ENDPOINT=http://localhost:8545 KEY=<private key> GASLIMIT=10000000 GASPRICE=50000000000 node staking-lock-asset.js

require('dotenv').config();
const ethers = require('ethers');
const { waitForTx } = require('./utils.js');

const StakingFactoryJson = require('../build/contracts/StakingFactory.json');
const StakingTemplateJson = require('../build/contracts/StakingTemplate.json')
const RegistryHubJson = require('../build/contracts/RegistryHub.json');
const SimpleERC20Json = require('../build/contracts/SimpleERC20.json');
const MintableERC20Json = require('../build/contracts/MintableERC20.json')
const ERC20AssetHandlerJson = require('../build/contracts/ERC20AssetHandler.json');
const LinearCalculatorJson = require('../build/contracts/LinearCalculator.json');
const Contracts = require('./contracts.json');

const RegistryHubAddress = Contracts.RegistryHub;
const StakingFactoryAddress = Contracts.StakingFactory;
const ERC20AssetHandlerAddress = Contracts.ERC20AssetHandler;
const LinearCalculatorAddress = Contracts.LinearCalculator;

async function mintableCommunity(env) {
    const RegistryHub = new ethers.Contract(RegistryHubAddress, RegistryHubJson.abi, env.provider);
    const mintableAsset = await RegistryHub.registryHub(env.wallet.address, 0);

    const StakingFactory = new ethers.Contract(
        StakingFactoryAddress, StakingFactoryJson.abi, env.wallet
    );
    const tx = await StakingFactory.createStakingFeast(
        mintableAsset, // reward asset
        LinearCalculatorAddress,// 
        [
            {
                "amount": 300,
                "startHeight": 9000,
                "stopHeight": 500000
            }
        ],  // distribution eras
        { gasPrice: env.gasPrice, gasLimit: env.gasLimit}
    );
    await waitForTx(env.provider, tx.hash);

    console.log('Create a new feast');
    StakingFactory.on('StakingFeastCreated', async (creater, stakingFeast, rewardAsset) => {
        const ERC20AssetHandler = new ethers.Contract(ERC20AssetHandlerAddress, ERC20AssetHandlerJson.abi, env.wallet)
        // await ERC20AssetHandler.adminAddWhitelistManager(creater, { gasPrice: env.gasPrice, gasLimit: env.gasLimit});
        const source = ethers.utils.keccak256('0x' + stakingFeast.substr(2) + rewardAsset.substr(2) + "61646d696e");
        const tx = await ERC20AssetHandler.unlockOrMintAsset(source, rewardAsset, creater, 1000000,
             { gasPrice: env.gasPrice, gasLimit: env.gasLimit});
        await waitForTx(env.provider, tx.hash)
    })
}

async function simpleCommunity(env) {
    const RegistryHub = new ethers.Contract(RegistryHubAddress, RegistryHubJson.abi, env.provider);
    const simpleAsset = await RegistryHub.registryHub(env.wallet.address, 1);

    const StakingFactory = new ethers.Contract(
        StakingFactoryAddress, StakingFactoryJson.abi, env.wallet
    );
    const tx = await StakingFactory.createStakingFeast(
        simpleAsset, // reward asset
        LinearCalculatorAddress,
        [
            {
                "amount": 300,
                "startHeight": 5000,
                "stopHeight": 500000
            }
        ],  // distribution eras
        { gasPrice: env.gasPrice, gasLimit: env.gasLimit}
    );
    await waitForTx(env.provider, tx.hash);
}

async function main() {
    let env = {};
    env.url = process.env.ENDPOINT || 'http://localhost:8545';
    env.privateKey = process.env.KEY;
    env.provider = new ethers.providers.JsonRpcProvider(env.url);
    env.wallet = new ethers.Wallet(env.privateKey, env.provider);
    env.gasLimit = ethers.utils.hexlify(Number(process.env.GASLIMIT));
    env.gasPrice = ethers.utils.hexlify(Number(process.env.GASPRICE));

    mintableCommunity(env);
    // simpleCommunity(env)

    process.stdin.resume();//so the program will not close instantly

    function exitHandler(options, exitCode) {
        if (options.cleanup) console.log('clean');
        if (exitCode || exitCode === 0) console.log(exitCode);
        if (options.exit) process.exit();
    }
    // Following copy from: https://stackoverflow.com/questions/14031763/doing-a-cleanup-action-just-before-node-js-exits/14032965#14032965
    //do something when app is closing
    process.on('exit', exitHandler.bind(null,{cleanup:true}));

    //catches ctrl+c event
    process.on('SIGINT', exitHandler.bind(null, {exit:true}));

    // catches "kill pid" (for example: nodemon restart)
    process.on('SIGUSR1', exitHandler.bind(null, {exit:true}));
    process.on('SIGUSR2', exitHandler.bind(null, {exit:true}));

    //catches uncaught exceptions
    process.on('uncaughtException', exitHandler.bind(null, {exit:true}));
}


main();