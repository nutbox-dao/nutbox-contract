// USAGE: 
//  ENDPOINT=http://localhost:8545 KEY=<private key> GASLIMIT=10000000 GASPRICE=50000000000 node upgrade-executor.js

require('dotenv').config();
const ethers = require('ethers');
const fs = require("fs");

const ERC20AssetHandlerJson = require('../build/contracts/ERC20AssetHandler.json');
const TrustlessAssetHandlerJson = require('../build/contracts/TrustlessAssetHandler.json');
const RegistryHubJson = require('../build/contracts/RegistryHub.json');
const BridgeJson = require('../build/contracts/Bridge.json');
const ExecutorV2Json = require('../build/contracts/ExecutorV2.json');
const Contracts = require('./contracts.json');

const RegistryHubAddress = Contracts.RegistryHub;
const ERC20AssetHandlerAddress = Contracts.ERC20AssetHandler;
const TrustlessAssetHandlerAddress = Contracts.TrustlessAssetHandler;
const BridgeAddress = Contracts.Bridge;
const StakingFactoryAddress = Contracts.StakingFactory;

async function deployExecutorV2Contract(env) {
    let factory = new ethers.ContractFactory(ExecutorV2Json.abi, ExecutorV2Json.bytecode, env.wallet);
    let contract = await factory.deploy(
        RegistryHubAddress,
        { gasPrice: env.gasPrice, gasLimit: env.gasLimit}
    );
    await contract.deployed();
    env.ExecutorV2Contract = contract.address;
    console.log("✓ ExecutorV2 contract has deployed", contract.address);
}

async function main() {
    let env = {};
    env.url = process.env.ENDPOINT || 'http://localhost:8545';
    env.privateKey = process.env.KEY;
    env.provider = new ethers.providers.JsonRpcProvider(env.url);
    env.wallet = new ethers.Wallet(env.privateKey, env.provider);
    env.gasLimit = ethers.utils.hexlify(Number(process.env.GASLIMIT));
    env.gasPrice = ethers.utils.hexlify(Number(process.env.GASPRICE));

    const registryHubContract = new ethers.Contract(RegistryHubAddress, RegistryHubJson.abi, env.wallet);
    const bridgeContract = new ethers.Contract(BridgeAddress, BridgeJson.abi, env.wallet);
    const trustlessAssetHandler = new ethers.Contract(TrustlessAssetHandlerAddress, TrustlessAssetHandlerJson.abi, env.wallet);
    const erc20AssetHandler = new ethers.Contract(ERC20AssetHandlerAddress, ERC20AssetHandlerJson.abi, env.wallet);

    await deployExecutorV2Contract(env);

    // TODO: Step0: Pause bridge

    // Step1: executor set bridge
    const executor = new ethers.Contract(env.ExecutorV2Contract, ExecutorV2Json.abi, env.wallet);
    await executor.adminSetBridge(BridgeAddress);
    console.log('✓ Executor has set bridge');

    // Step2: ERC20AssetHandler set new Executor to whitelist
    await erc20AssetHandler.setWhitelist(env.ExecutorV2Contract);
    console.log('✓ Add Executor into whitelist of ERC20AssetHandler');

    // Step3: TrustlessAssetHandler set new Executor to whitelist
    await trustlessAssetHandler.setExecutor(env.ExecutorV2Contract);
    console.log('✓ Add Executor into whitelist of TrustlessAssetHandler');

    // TODO: add Executor into whitelist of ERC721AssetHandler

    // Step4: TrustlessAssetHandler set executor
    await trustlessAssetHandler.setExecutor(env.ExecutorV2Contract);
    console.log('✓ TrustlessAssetHandler has set executor');

    // Step5: Bridge set executor
    await bridgeContract.adminSetExecutor(env.ExecutorV2Contract);
    console.log('✓ Bridge has set executor');
    
    // TODO: Step6: Resume bridge

    console.log(`==> Executor of bridge is: ${await bridgeContract.executor()}`);
    console.log(`==> Executor of trustless asset handler is: ${await trustlessAssetHandler.executor()}`);
}

main()
.catch(console.error)
.finally(() => process.exit());

