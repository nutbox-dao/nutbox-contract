// USAGE: 
//  ENDPOINT=http://localhost:8545 KEY=<private key> GASLIMIT=10000000 GASPRICE=50000000000 node trustlessasset-staking.js

require('dotenv').config();
const ethers = require('ethers');
const { waitForTx, utf8ToHex } = require('./utils.js');

const StakingFactoryJson = require('../build/contracts/StakingFactory.json');
const StakingTemplateJson = require('../build/contracts/StakingTemplate.json')
const RegistryHubJson = require('../build/contracts/RegistryHub.json');
const SimpleERC20Json = require('../build/contracts/SimpleERC20.json');
const ERC20AssetHandlerJson = require('../build/contracts/ERC20AssetHandler.json');
const TrustlessAssetHandlerJson = require('../build/contracts/TrustlessAssetHandler.json');
const BridgeJson= require('../build/contracts/Bridge.json');
const Contracts = require('./contracts.json');

const RegistryHubAddress = Contracts.RegistryHub;
const StakingFactoryAddress = Contracts.StakingFactory;
const ERC20AssetHandlerAddress = Contracts.ERC20AssetHandler;
const TrustlessAssetHandlerAddress = Contracts.TrustlessAssetHandler;
const BridgeAddress = Contracts.Bridge;
const LinearCalculatorAddress = Contracts.LinearCalculator;

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
    const substrateCrowdloanAsset = await RegistryHub.registryHub(env.wallet.address, 2);
    console.log('substrateCrowdloanAsset: ', substrateCrowdloanAsset);

    const StakingFactory = new ethers.Contract(
        StakingFactoryAddress, StakingFactoryJson.abi, env.wallet
    );
    const tx = await StakingFactory.createStakingFeast(
        homeChainAsset, // reward asset
        LinearCalculatorAddress, // reward calculator
        [
            {
                "amount": 300,
                "startHeight": 7000,
                "stopHeight": 6000000
            }
        ],  // distribution eras
        { gasPrice: env.gasPrice, gasLimit: env.gasLimit}
    );
    await waitForTx(env.provider, tx.hash);
    console.log('Create a new feast');

    StakingFactory.on('StakingFeastCreated', async (creater, stakingFeast, rewardAsset) => {

        // add pool into staking feast
        const StakingFeast = new ethers.Contract(stakingFeast, StakingTemplateJson.abi, env.wallet);
        const tx = await StakingFeast.addPool(
            substrateCrowdloanAsset,
            'Crowdloan',
            [10000],
            { gasPrice: env.gasPrice, gasLimit: env.gasLimit}
        );
        await waitForTx(env.provider, tx.hash);

        /**** Following are simulation of bridge proposal's voting and execution ****/
        const Bridge = new ethers.Contract(BridgeAddress, BridgeJson.abi, env.wallet);
        // add current sender as relayer( NOT IN PRODUCTION ENV)
        const tx1 = await Bridge.adminAddRelayer(env.wallet.address, { gasPrice: env.gasPrice, gasLimit: env.gasLimit});
        await waitForTx(env.provider, tx1.hash);

        // set threshold
        const tx2 = await Bridge.adminSetThreshold(1, { gasPrice: env.gasPrice, gasLimit: env.gasLimit});
        await waitForTx(env.provider, tx2.hash);

        const bindAccount = 'an example of dynamic length bind account';
        // generate extrinsic
        const extrinsic = '0x' + 
            ethers.utils.hexZeroPad(ethers.utils.hexlify(0), 1).substr(2) + // extrinsicType: 0
            ethers.utils.hexZeroPad(ethers.utils.hexlify(0), 1).substr(2) + // assetType: 0
            substrateCrowdloanAsset.substr(2) + // assetId
            env.wallet.address.substr(2) + // recipientBytes
            ethers.utils.hexZeroPad(ethers.BigNumber.from(1000000000).toHexString(), 32).substr(2) + // amount
            ethers.utils.hexZeroPad(ethers.BigNumber.from(bindAccount.length).toHexString(), 32).substr(2) + // bindAccount length
            utf8ToHex(bindAccount);    // bindAccount
        
        // generate extrinsicHash
        const extrinsicHash = ethers.utils.keccak256(extrinsic);

        // vote proposal
        const tx3 = await Bridge.voteProposal(
            2,  // chainId: polkadot
            0,  // sequence: 0
            extrinsicHash,
            extrinsic,
            { gasPrice: env.gasPrice, gasLimit: env.gasLimit}
        );
        await waitForTx(env.provider, tx3.hash);
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
