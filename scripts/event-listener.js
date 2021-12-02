// USAGE:
//  ENDPOINT=http://localhost:8545 node event-listener.js

const ethers = require('ethers');

const CommitteeJson = require('../build/contracts/Committee.json')
const CommunityFactoryJson = require('../build/contracts/CommunityFactory.json')
const SPStakingFactoryJson = require('../build/contracts/SPStakingFactory.json')
const ERC20StakingFactoryJson = require('../build/contracts/ERC20StakingFactory.json')

const Addresses = require("./contracts.json");
const { waitForTx } = require('./utils');

const CommitteeAddress = Addresses.Committee;
const CommunityFactoryAddress = Addresses.CommunityFactory;
const SPStakingFactoryAddress = Addresses.SPStakingFactory;
const ERC20StakingFactoryAddress = Addresses.ERC20StakingFactory;

const NutAddress = '0x926E99b548e5D48Ca4C6215878b954ABd0f5D1f6'

function main() {
    let env = {};
    env.url = process.env.ENDPOINT || 'http://localhost:8545';
    env.provider = new ethers.providers.JsonRpcProvider(env.url);

    const Committee = new ethers.Contract(CommitteeAddress, CommitteeJson.abi, env.provider);
    Committee.on('NewRevenue', (feeType, who, amount) => {
        console.log(`Committee::NewRevenue(${feeType}, ${who}, ${amount.toString() / 1e18})`);
    });

    const CommunityFactory = new ethers.Contract(CommunityFactoryAddress, CommunityFactoryJson.abi, env.provider)
    CommunityFactory.on('CommunityCreated', (creator, community, token) => {
        console.log(`CommunityFactory::CommunityCreated(${creator}, ${community}, ${token})`);
    })
    CommunityFactory.on('ERC20TokenCreated', (token, owner, propertied) => {
        console.log(`CommunityFactory::ERC20TokenCreated(${token}, ${owner}, ${propertied})`);
    })
    
    const SPStakingFactory = new ethers.Contract(SPStakingFactoryAddress, SPStakingFactoryJson.abi, env.provider)
    SPStakingFactory.on('SPStakingCreated', (pool, community, chainId, delegatee) => {
        console.log(`SPStakingFactory::SPStakingCreated(${pool}, ${community}, ${chainId}, ${ethers.utils.parseBytes32String(delegatee)})`);
    })

    const ERC20StakingFactory = new ethers.Contract(ERC20StakingFactoryAddress, ERC20StakingFactoryJson.abi, env.provider)
    ERC20StakingFactory.on('ERC20StakingCreated', (pool, community, erc20Token) => {
        console.log(`ERC20StakingFactory::ERC20StakingCreated(${pool}, ${community}, ${erc20Token})`);
    })

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
