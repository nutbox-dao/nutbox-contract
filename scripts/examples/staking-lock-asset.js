// USAGE: 
//  ENDPOINT=http://localhost:8545 KEY=<private key> GASLIMIT=10000000 GASPRICE=50000000000 node staking-lock-asset.js

require('dotenv').config();
const ethers = require('ethers');
const { waitForTx } = require('../utils.js');

const StakingFactoryJson = require('../../build/contracts/StakingFactory.json');
const StakingTemplateJson = require('../../build/contracts/StakingTemplate.json')
const RegistryHubJson = require('../../build/contracts/RegistryHub.json');
const SimpleERC20Json = require('../../build/contracts/SimpleERC20.json');
const ERC20AssetHandlerJson = require('../../build/contracts/ERC20AssetHandler.json');
const Contracts = require('../contracts.json');

const RegistryHubAddress = Contracts.RegistryHub;
const StakingFactoryAddress = Contracts.StakingFactory;
const ERC20AssetHandlerAddress = Contracts.ERC20AssetHandler;

async function main() {
    let env = {};
    env.url = process.env.ENDPOINT || 'http://localhost:8545';
    env.privateKey = process.env.KEY;
    env.provider = new ethers.providers.JsonRpcProvider(env.url);
    env.wallet = new ethers.Wallet(env.privateKey, env.provider);
    env.gasLimit = ethers.utils.hexlify(Number(process.env.GASLIMIT));
    env.gasPrice = ethers.utils.hexlify(Number(process.env.GASPRICE));

    const RegistryHub = new ethers.Contract(RegistryHubAddress, RegistryHubJson.abi, env.provider);
    const homeChainAsset = await RegistryHub.registryHub(env.wallet.address, 0);

    const StakingFactory = new ethers.Contract(
        StakingFactoryAddress, StakingFactoryJson.abi, env.wallet
    );
    const tx = await StakingFactory.createStakingFeast(
        homeChainAsset, // reward asset
        [
            {
                "hasPassed": false,
                "amount": 300,
                "startHeight": 201,
                "stopHeight": 300
            },
            {
                "hasPassed": false,
                "amount": 200,
                "startHeight": 301,
                "stopHeight": 400
            },
            {
                "hasPassed": false,
                "amount": 100,
                "startHeight": 401,
                "stopHeight": 500
            }
        ],  // distribution eras
        { gasPrice: env.gasPrice, gasLimit: env.gasLimit}
    );
    await waitForTx(env.provider, tx.hash);

    StakingFactory.on('StakingFeastCreated', async (creater, stakingFeast, rewardAsset) => {

        // add staking feast to whitelist of erc20 asset handler, so that it has the permission to deposit reward
        const ERC20AssetHandler = new ethers.Contract(ERC20AssetHandlerAddress, ERC20AssetHandlerJson.abi, env.wallet);
        const tx0 = await ERC20AssetHandler.setWhiteList(   // need admin permission
            stakingFeast, 
            { gasPrice: env.gasPrice, gasLimit: env.gasLimit}
        );
        await waitForTx(env.provider, tx0.hash);

        // approve
        const rewardHomeLocation = await RegistryHub.getHomeLocation(rewardAsset);
        const SimpleERC20 = new ethers.Contract(rewardHomeLocation, SimpleERC20Json.abi, env.wallet);
        const tx1 = await SimpleERC20.approve(
            ERC20AssetHandlerAddress,
            500000000,
            { gasPrice: env.gasPrice, gasLimit: env.gasLimit}
        );
        await waitForTx(env.provider, tx1.hash);

        // staking feast owner deposit reward
        const StakingFeast = new ethers.Contract(stakingFeast, StakingTemplateJson.abi, env.wallet);
        const tx2 = await StakingFeast.adminDepositReward(
            100000000, 
            { gasPrice: env.gasPrice, gasLimit: env.gasLimit}
        );
        await waitForTx(env.provider, tx2.hash);

        // query balance
        const source = ethers.utils.keccak256('0x' + stakingFeast.substr(2) + homeChainAsset.substr(2));
        const depositedReward = await ERC20AssetHandler.getBalance(source);
        console.log(`Deposited reward by ${env.wallet.address}: ${depositedReward}`);
    });

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
