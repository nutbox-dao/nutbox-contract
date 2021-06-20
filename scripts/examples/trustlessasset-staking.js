// USAGE: 
//  ENDPOINT=http://localhost:8545 KEY=<private key> GASLIMIT=10000000 GASPRICE=50000000000 node trustlessasset-staking.js

require('dotenv').config();
const ethers = require('ethers');
const { waitForTx } = require('../utils.js');

const StakingFactoryJson = require('../../build/contracts/StakingFactory.json');
const StakingTemplateJson = require('../../build/contracts/StakingTemplate.json')
const RegistryHubJson = require('../../build/contracts/RegistryHub.json');
const SimpleERC20Json = require('../../build/contracts/SimpleERC20.json');
const ERC20AssetHandlerJson = require('../../build/contracts/ERC20AssetHandler.json');
const TrustlessAssetHandlerJson = require('../../build/contracts/TrustlessAssetHandler.json');
const BridgeJson= require('../../build/contracts/Bridge.json');

const RegistryHubAddress = '0x30E0b89a526f33395c2b560724b071B3AF158E2c';
const StakingFactoryAddress = '0xd679D28925bFD2BBD162d94193FAA87e3C15eC74';
const ERC20AssetHandlerAddress = '0x53212181581FCa0f65Db352a15775486dF338F3C';
const TrustlessAssetHandlerAddress = '0xF3746ef2cF02f291da86649B87e773232319f089';
const BridgeAddress = '0xf697A0E388f0b3322eC454a15E8FD828851b7073';

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

        // add pool into staking feast
        const StakingFeast = new ethers.Contract(stakingFeast, StakingTemplateJson.abi, env.wallet);
        const tx = await StakingFeast.addPool(
            substrateCrowdloanAsset,
            [100],
            { gasPrice: env.gasPrice, gasLimit: env.gasLimit}
        );
        await waitForTx(env.provider, tx.hash);

        // attach pool
        // FIXME: Only bridge has permission attach pool so far
        const TrustlessAssetHandler = new ethers.Contract(TrustlessAssetHandlerAddress, TrustlessAssetHandlerJson.abi, env.wallet);
        const tx0 = await TrustlessAssetHandler.attachPool(
            substrateCrowdloanAsset,
            stakingFeast,
            0,
            { gasPrice: env.gasPrice, gasLimit: env.gasLimit}
        );
        await waitForTx(env.provider, tx0.hash);

        /**** Following are simulation of bridge proposal's voting and execution ****/
        const Bridge = new ethers.Contract(BridgeAddress, BridgeJson.abi, env.wallet);
        // add current sender as relayer( NOT IN PRODUCTION ENV)
        const tx1 = await Bridge.adminAddRelayer(env.wallet.address, { gasPrice: env.gasPrice, gasLimit: env.gasLimit});
        await waitForTx(env.provider, tx1.hash);

        // set threadhold
        const tx2 = await Bridge.adminSetThreadhold(1, { gasPrice: env.gasPrice, gasLimit: env.gasLimit});
        await waitForTx(env.provider, tx2.hash);

        // generate extrinsic
        const extrinsic = '0x' + 
            ethers.utils.hexZeroPad(ethers.utils.hexlify(0), 1).substr(2) + // extrinsicType: 0
            ethers.utils.hexZeroPad(ethers.utils.hexlify(0), 1).substr(2) + // assetType: 0
            substrateCrowdloanAsset.substr(2) + // assetId
            env.wallet.address.substr(2) + // recipientBytes
            ethers.utils.hexZeroPad(ethers.utils.bigNumberify(1000000000).toHexString(), 32).substr(2); // amount
        
        // generate extrinsicHash
        const extrinsicHash = ethers.utils.keccak256(extrinsic);

        // vote proposal
        const tx3 = await Bridge.voteProposal(
            2,  // chainId: polkadot
            0,  // sequence: 0
            extrinsicHash,
            { gasPrice: env.gasPrice, gasLimit: env.gasLimit}
        );
        await waitForTx(env.provider, tx3.hash);

        // execute proposal
        const tx4 = await Bridge.executeProposal(
            2,
            0,
            extrinsicHash,
            extrinsic,
            { gasPrice: env.gasPrice, gasLimit: env.gasLimit}
        );
        await waitForTx(env.provider, tx4.hash);
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
