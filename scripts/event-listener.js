// USAGE:
//  ENDPOINT=http://localhost:8545 node event-listener.js

const ethers = require('ethers');

const ERC20AssetHandlerJson = require('../build/contracts/ERC20AssetHandler.json');
const TrustlessAssetHandlerJson = require('../build/contracts/TrustlessAssetHandler.json');
const RegistryHubJson = require('../build/contracts/RegistryHub.json');
const HomeChainAssetRegistryJson = require('../build/contracts/HomeChainAssetRegistry.json');
const SteemHiveDelegateAssetRegistryJson = require('../build/contracts/SteemHiveDelegateAssetRegistry.json');
const SubstrateCrowdloanAssetRegistryJson = require('../build/contracts/SubstrateCrowdloanAssetRegistry.json');
const SubstrateNominateAssetRegistryJson = require('../build/contracts/SubstrateNominateAssetRegistry.json');
const StakingFactoryJson = require('../build/contracts/StakingFactory.json');
const StakingTemplateJson = require('../build/contracts/StakingTemplate.json');
const ExectorJson = require('../build/contracts/Executor.json');
const BridgeJson = require('../build/contracts/Bridge.json');
const SimpleERC20Json = require('../build/contracts/SimpleERC20.json');
const Contracts = require('./contracts.json');

const RegistryHubAddress = Contracts.RegistryHub;
const HomeChainAssetRegistryAddress = Contracts.HomeChainAssetRegistry;
const SteemHiveDelegateAssetRegistryAddress = Contracts.SteemHiveDelegateAssetRegistry;
const SubstrateCrowdloanAssetRegistryAddress = Contracts.SubstrateCrowdloanAssetRegistry;
const SubstrateNominateAssetRegistryAddress = Contracts.SubstrateNominateAssetRegistry;
const ERC20AssetHandlerAddress = Contracts.ERC20AssetHandler;
const TrustlessAssetHandlerAddress = Contracts.TrustlessAssetHandler;
const ExecutorAddress = Contracts.Executor;
const BridgeAddress = Contracts.Bridge;
const StakingFactoryAddress = Contracts.StakingFactory;

function main() {
    let env = {};
    env.url = process.env.ENDPOINT || 'http://localhost:8545';
    env.provider = new ethers.providers.JsonRpcProvider(env.url);

    const RegistryHub = new ethers.Contract(RegistryHubAddress, RegistryHubJson.abi, env.provider);
    RegistryHub.on('NewAsset', (owner, id) => {
        console.log(`RegistryHub::NewAsset(${owner}, ${id})`);
    });

    const HomeChainAssetRegistry = new ethers.Contract(HomeChainAssetRegistryAddress, HomeChainAssetRegistryJson.abi, env.provider);
    HomeChainAssetRegistry.on('HomeChainAssetRegistered', (owner, id, location) => {
        console.log(`HomeChainAssetRegistry::HomeChainAssetRegistered(${owner}, ${id}, ${location})`);
    });

    const SteemHiveDelegateAssetRegistry = new ethers.Contract(SteemHiveDelegateAssetRegistryAddress, SteemHiveDelegateAssetRegistryJson.abi, env.provider);
    SteemHiveDelegateAssetRegistry.on('SteemHiveDelegateAssetRegisterd', (owner, id, meta) => {
        console.log(`SteemHiveDelegateAssetRegistry::SteemHiveDelegateAssetRegisterd(${owner}, ${id}, ${meta})`);
    });

    const SubstrateCrowdloanAssetRegistry = new ethers.Contract(SubstrateCrowdloanAssetRegistryAddress, SubstrateCrowdloanAssetRegistryJson.abi, env.provider);
    SubstrateCrowdloanAssetRegistry.on('SubstrateCrowdloanAssetRegistered', (owner, id, meta) => {
        console.log(`SubstrateCrowdloanAssetRegistry::SubstrateCrowdloanAssetRegistered(${owner}, ${id}, ${meta})`);
    });

    const SubstrateNominateAssetRegistry = new ethers.Contract(SubstrateNominateAssetRegistryAddress, SubstrateNominateAssetRegistryJson.abi, env.provider);
    SubstrateNominateAssetRegistry.on('SubstrateNominateAssetRegistered', (owner, id, meta) => {
        console.log(`SubstrateNominateAssetRegistry::SubstrateNominateAssetRegistered(${owner}, ${id}, ${meta})`);
    });

    const ERC20AssetHandler = new ethers.Contract(ERC20AssetHandlerAddress, ERC20AssetHandlerJson.abi, env.provider);
    ERC20AssetHandler.on('WhitelistManagerAdded', (manager) => {
        console.log(`ERC20AssetHandler::WhitelistManagerAdded(${manager})`);
    });
    ERC20AssetHandler.on('WhitelistManagerRemoved', (manager) => {
        console.log(`ERC20AssetHandler::WhitelistManagerRemoved(${manager})`);
    });
    ERC20AssetHandler.on('LockAsset', (source, assetId, depositer, amount) => {
        console.log(`ERC20AssetHandler::LockAsset(${source}, ${assetId}, ${depositer}, ${amount})`);
    });
    ERC20AssetHandler.on('BurnAsset', (source, assetId, depositer, amount) => {
        console.log(`ERC20AssetHandler::BurnAsset(${source}, ${assetId}, ${depositer}, ${amount})`);
    });
    ERC20AssetHandler.on('UnlockAsset', (source, assetId, depositer, amount) => {
        console.log(`ERC20AssetHandler::UnlockAsset(${source}, ${assetId}, ${recipient}, ${amount})`);
    });
    ERC20AssetHandler.on('MintAsset', (source, assetId, depositer, amount) => {
        console.log(`ERC20AssetHandler::MintAsset(${source}, ${assetId}, ${recipient}, ${amount})`);
    });

    const TrustlessAssetHandler = new ethers.Contract(TrustlessAssetHandlerAddress, TrustlessAssetHandlerJson.abi, env.provider);
    TrustlessAssetHandler.on('AttachedPool', (assetId, stakingFeast, pid) => {
        console.log(`TrustlessAssetHandler::AttachedPool(${assetId}, ${stakingFeast}, ${pid})`);
    });
    TrustlessAssetHandler.on('BalanceUpdated', (source, assetId, account, amount) => {
        console.log(`TrustlessAssetHandler::BalanceUpdated(${source}, ${assetId}, ${account}, ${amount})`);
    });

    const Bridge = new ethers.Contract(BridgeAddress, BridgeJson.abi, env.provider);
    Bridge.on('ProposalVoted', (proposal, relayer) => {
        console.log(`Bridge::ProposalVoted(${proposal}, ${relayer})`);
    });
    Bridge.on('ProposalCancelled', (proposal, relayer) => {
        console.log(`Bridge::ProposalCancelled(${proposal}, ${relayer})`);
    });
    Bridge.on('ProposalPassed', (proposal, relayer) => {
        console.log(`Bridge::ProposalPassed(${proposal}, ${relayer})`);
    });
    Bridge.on('ProposalExecuted', (proposal, relayer) => {
        console.log(`Bridge::ProposalExecuted(${proposal}, ${relayer})`);
    });

    const StakingFactory = new ethers.Contract(StakingFactoryAddress, StakingFactoryJson.abi, env.provider);
    StakingFactory.on('StakingFeastCreated', (creater, stakingFeast, rewardAsset) => {
        console.log(`StakingFactory::StakingFeastCreated(${creater}, ${stakingFeast}, ${rewardAsset})`);
        // start watch events of the staking feast
        const StakingFeast = new ethers.Contract(stakingFeast, StakingTemplateJson.abi, env.provider);
        StakingFeast.on('Deposit', (pid, nutboxAccount, amount) => {
            console.log(`StakingFeast[${stakingFeast}]::Deposit(${pid}, ${nutboxAccount}, ${amount})`);
        });
        StakingFeast.on('Withdraw', (pid, nutboxAccount, amount) => {
            console.log(`StakingFeast[${stakingFeast}]::Withdraw(${pid}, ${nutboxAccount}, ${amount})`);
        });
        StakingFeast.on('WithdrawRewards', (nutboxAccount, amount) => {
            console.log(`StakingFeast[${stakingFeast}]::WithdrawRewards(${nutboxAccount}, ${amount})`);
        });
        StakingFeast.on('NewDistributionEra', (amount, startHeight, stopHeight) => {
            console.log(`StakingFeast[${stakingFeast}]::NewDistributionEra(${amount}, ${startHeight}, ${stopHeight})`);
        });
        StakingFeast.on('PoolUpdated', (pid, reward, shareAcc) => {
            console.log(`StakingFeast[${stakingFeast}]::PoolUpdated(${pid}, ${reward}, ${shareAcc})`);
        });
        StakingFeast.on('RewardComputed', (from, to, reward) => {
            console.log(`StakingFeast[${stakingFeast}]::RewardComputed(${from}, ${to}, ${reward})`);
        });
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
