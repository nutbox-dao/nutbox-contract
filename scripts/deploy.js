// USAGE: 
//  ENDPOINT=http://localhost:8545 KEY=<private key> GASLIMIT=10000000 GASPRICE=50000000000 node deploy.js

require('dotenv').config();
const ethers = require('ethers');
const fs = require("fs");

const ERC20AssetHandlerJson = require('../build/contracts/ERC20AssetHandler.json');
const TrustlessAssetHandlerJson = require('../build/contracts/TrustlessAssetHandler.json');
const RegistryHubJson = require('../build/contracts/RegistryHub.json');
const HomeChainAssetRegistryJson = require('../build/contracts/HomeChainAssetRegistry.json');
const SteemHiveDelegateAssetRegistryJson = require('../build/contracts/SteemHiveDelegateAssetRegistry.json');
const SubstrateCrowdloanAssetRegistryJson = require('../build/contracts/SubstrateCrowdloanAssetRegistry.json');
const SubstrateNominateAssetRegistryJson = require('../build/contracts/SubstrateNominateAssetRegistry.json');
const StakingFactoryJson = require('../build/contracts/StakingFactory.json');
const ExectorJson = require('../build/contracts/Executor.json');
const BridgeJson = require('../build/contracts/Bridge.json');
const SimpleERC20Json = require('../build/contracts/SimpleERC20.json');

async function deployRegistryHubContract(env) {
    let factory = new ethers.ContractFactory(RegistryHubJson.abi, RegistryHubJson.bytecode, env.wallet);
    let contract = await factory.deploy(
        { gasPrice: env.gasPrice, gasLimit: env.gasLimit}
    );
    await contract.deployed();
    env.registryHubContract = contract.address;
    console.log("✓ RegistryHub contract deployed");
}

async function deployHomeChainAssetRegistryContract(env) {
    let factory = new ethers.ContractFactory(HomeChainAssetRegistryJson.abi, HomeChainAssetRegistryJson.bytecode, env.wallet);
    let contract = await factory.deploy(
        env.registryHubContract,
        { gasPrice: env.gasPrice, gasLimit: env.gasLimit}
    );
    await contract.deployed();
    env.homeChainAssetRegistryContract = contract.address;
    console.log("✓ HomeChainAssetRegistry contract deployed");
}

async function deploySteemHiveDelegateAssetRegistryContract(env) {
    let factory = new ethers.ContractFactory(SteemHiveDelegateAssetRegistryJson.abi, SteemHiveDelegateAssetRegistryJson.bytecode, env.wallet);
    let contract = await factory.deploy(
        env.registryHubContract,
        { gasPrice: env.gasPrice, gasLimit: env.gasLimit}
    );
    await contract.deployed();
    env.steemHiveDelegateAssetRegistryContract = contract.address;
    console.log("✓ SteemHiveDelegateAssetRegistry contract deployed");
}

async function deploySubstrateCrowdloanAssetRegistryContract(env) {
    let factory = new ethers.ContractFactory(SubstrateCrowdloanAssetRegistryJson.abi, SubstrateCrowdloanAssetRegistryJson.bytecode, env.wallet);
    let contract = await factory.deploy(
        env.registryHubContract,
        { gasPrice: env.gasPrice, gasLimit: env.gasLimit}
    );
    await contract.deployed();
    env.substrateCrowdloanAssetRegistryContract = contract.address;
    console.log("✓ SubstrateCrowdloanAssetRegistry contract deployed");
}

async function deploySubstrateNominateAssetRegistryContract(env) {
    let factory = new ethers.ContractFactory(SubstrateNominateAssetRegistryJson.abi, SubstrateNominateAssetRegistryJson.bytecode, env.wallet);
    let contract = await factory.deploy(
        env.registryHubContract,
        { gasPrice: env.gasPrice, gasLimit: env.gasLimit}
    );
    await contract.deployed();
    env.substrateNominateAssetRegistryContract = contract.address;
    console.log("✓ SubstrateNominateAssetRegistry contract deployed");
}

async function deployExectorContract(env) {
    let factory = new ethers.ContractFactory(ExectorJson.abi, ExectorJson.bytecode, env.wallet);
    let contract = await factory.deploy(
        env.registryHubContract,
        { gasPrice: env.gasPrice, gasLimit: env.gasLimit}
    );
    await contract.deployed();
    env.exectorContract = contract.address;
    console.log("✓ Proposal Exector contract deployed");
}

async function deployBridgeContract(env) {
    let factory = new ethers.ContractFactory(BridgeJson.abi, BridgeJson.bytecode, env.wallet);
    let contract = await factory.deploy(
        env.registryHubContract,
        env.exectorContract,
        ethers.utils.parseEther(env.bridgeFee.toString()),
        env.bridgeExpiry,
        { gasPrice: env.gasPrice, gasLimit: env.gasLimit}

    );
    await contract.deployed();
    env.bridgeContract = contract.address;
    console.log("✓ Bridge contract deployed");
}

async function deployERC20AssetHandlerContract(env) {
    let factory = new ethers.ContractFactory(ERC20AssetHandlerJson.abi, ERC20AssetHandlerJson.bytecode, env.wallet);
    let contract = await factory.deploy(
        env.registryHubContract,
        { gasPrice: env.gasPrice, gasLimit: env.gasLimit}

    );
    await contract.deployed();
    env.erc20AssetHandlerContract = contract.address;
    console.log("✓ ERC20AssetHandler contract deployed");
}

async function deployTrustlessAssetHandlerContract(env) {
    let factory = new ethers.ContractFactory(TrustlessAssetHandlerJson.abi, TrustlessAssetHandlerJson.bytecode, env.wallet);
    let contract = await factory.deploy(
        env.registryHubContract,
        env.bridgeContract,
        { gasPrice: env.gasPrice, gasLimit: env.gasLimit}
    );
    await contract.deployed();
    env.trustlessAssetHandlerContract = contract.address;
    console.log("✓ TrustlessAssetHandler contract deployed");
}

async function deployStakingFactoryContract(env) {
    let factory = new ethers.ContractFactory(StakingFactoryJson.abi, StakingFactoryJson.bytecode, env.wallet);
    let contract = await factory.deploy(
        env.registryHubContract,
        env.feeAddr,
        { gasPrice: env.gasPrice, gasLimit: env.gasLimit}

    );
    await contract.deployed();
    env.stakingFactoryContract = contract.address;
    console.log("✓ StakingFactory contract deployed");
}

async function deployERC20(env) {
    const factory = new ethers.ContractFactory(SimpleERC20Json.abi, SimpleERC20Json.bytecode, env.wallet);
    const contract = await factory.deploy("", "", { gasPrice: env.gasPrice, gasLimit: env.gasLimit});
    await contract.deployed();
    env.simpleERC20Contract = contract.address;
    console.log("✓ Simple ERC20 contract deployed");
}

async function main() {
    let env = {};
    env.url = process.env.ENDPOINT || 'http://localhost:8545';
    env.privateKey = process.env.KEY;
    env.provider = new ethers.providers.JsonRpcProvider(env.url);
    env.wallet = new ethers.Wallet(env.privateKey, env.provider);
    env.gasLimit = ethers.utils.hexlify(Number(process.env.GASLIMIT));
    env.gasPrice = ethers.utils.hexlify(Number(process.env.GASPRICE));

    // hardcode
    env.bridgeFee = 0;
    env.bridgeExpiry = 10;
    env.feeAddr = env.wallet.address;

    let startBalance = await env.provider.getBalance(env.wallet.address)

    // deploy asset contracts
    await deployRegistryHubContract(env);
    await deployHomeChainAssetRegistryContract(env);
    await deploySteemHiveDelegateAssetRegistryContract(env);
    await deploySubstrateCrowdloanAssetRegistryContract(env);
    await deploySubstrateNominateAssetRegistryContract(env);

    // deploy bridge contract
    await deployExectorContract(env);
    await deployBridgeContract(env);

    // deploy asset handlers
    await deployERC20AssetHandlerContract(env);
    await deployTrustlessAssetHandlerContract(env);

    // registryHub set asset handlers
    const registryHub = new ethers.Contract(env.registryHubContract, RegistryHubJson.abi, env.wallet);
    await registryHub.setAssetHandlers(env.erc20AssetHandlerContract, '0x0000000000000000000000000000000000000000', env.trustlessAssetHandlerContract);
    console.log('RegistryHub has set asset handlers');

    // exector set bridge
    const executor = new ethers.Contract(env.exectorContract, ExectorJson.abi, env.wallet);
    await executor.adminSetBridge(env.bridgeContract);
    console.log('Executor has set bridge');

    // deploy staking factory contract
    await deployStakingFactoryContract(env);

    // set StakingFactory as whitelist manager of ERC20AssetHandler
    const erc20AssetHandler = new ethers.Contract(env.erc20AssetHandlerContract, ERC20AssetHandlerJson.abi, env.wallet);
    await erc20AssetHandler.adminAddWhitelistManager(env.stakingFactoryContract);
    console.log('Set StakingFactory as whitelist manager of ERC20AssetHandler');

    // set StakingFactory as whitelist manager of TrustlessAssetHandler
    const trustlessAssetHandler = new ethers.Contract(env.trustlessAssetHandlerContract, TrustlessAssetHandlerJson.abi, env.wallet);
    await trustlessAssetHandler.adminAddWhitelistManager(env.stakingFactoryContract);
    console.log('Set StakingFactory as whitelist manager of TrustlessAssetHandler');

    let deployCost = startBalance.sub((await env.provider.getBalance(env.wallet.address)))

    // dump to local file
    const output = {
        RegistryHub: env.registryHubContract ? env.registryHubContract : "Not Deployed",
        HomeChainAssetRegistry: env.homeChainAssetRegistryContract ? env.homeChainAssetRegistryContract : "Not Deployed",
        SteemHiveDelegateAssetRegistry: env.steemHiveDelegateAssetRegistryContract ? env.steemHiveDelegateAssetRegistryContract : "Not Deployed",
        SubstrateCrowdloanAssetRegistry: env.substrateCrowdloanAssetRegistryContract ? env.substrateCrowdloanAssetRegistryContract : "Not Deployed",
        SubstrateNominateAssetRegistry: env.substrateNominateAssetRegistryContract ? env.substrateNominateAssetRegistryContract : "Not Deployed",
        ERC20AssetHandler: env.erc20AssetHandlerContract ? env.erc20AssetHandlerContract : "Not Deployed",
        ERC721AssetHandler: env.erc721AssetHandlerContract ? env.erc721AssetHandlerContract : "Not Deployed",
        TrustlessAssetHandler: env.trustlessAssetHandlerContract ? env.trustlessAssetHandlerContract : "Not Deployed",
        Executor:  env.exectorContract ? env.exectorContract : "Not Deployed",
        Bridge: env.bridgeContract ? env.bridgeContract : "Not Deployed",
        StakingFactory: env.stakingFactoryContract ? env.stakingFactoryContract : "Not Deployed"
    };
    
    const outfile = './contracts.json'
    const jsonStr = JSON.stringify(output, undefined, 2);
    fs.writeFileSync(outfile, jsonStr, { encoding: "utf-8" });

    console.log(`
    ================================================================
    Url:        ${env.url}
    Deployer:   ${env.wallet.address}
    Gas Limit:   ${ethers.BigNumber.from(env.gasLimit)}
    Gas Price:   ${ethers.BigNumber.from(env.gasPrice)}
    Deploy Cost: ${ethers.utils.formatEther(deployCost)}
    
    Options
    =======
    Bridge Fee:     ${env.bridgeFee}
    Bridge Expiry:  ${env.bridgeExpiry}
    Fee Addr:       ${env.feeAddr}
    
    Contract Addresses
    ================================================================
    RegistryHub:                        ${env.registryHubContract ? env.registryHubContract : "Not Deployed"}
    ----------------------------------------------------------------
    HomeChainAssetRegistry:             ${env.homeChainAssetRegistryContract ? env.homeChainAssetRegistryContract : "Not Deployed"}
    ----------------------------------------------------------------
    SteemHiveDelegateAssetRegistry:     ${env.steemHiveDelegateAssetRegistryContract ? env.steemHiveDelegateAssetRegistryContract : "Not Deployed"}
    ----------------------------------------------------------------
    SubstrateCrowdloanAssetRegistry:    ${env.substrateCrowdloanAssetRegistryContract ? env.substrateCrowdloanAssetRegistryContract : "Not Deployed"}
    ----------------------------------------------------------------
    SubstrateNominateAssetRegistry:     ${env.substrateNominateAssetRegistryContract ? env.substrateNominateAssetRegistryContract : "Not Deployed"}
    ----------------------------------------------------------------
    ERC20AssetHandler:                  ${env.erc20AssetHandlerContract ? env.erc20AssetHandlerContract : "Not Deployed"}
    ----------------------------------------------------------------
    ERC721AssetHandler:                 ${env.erc721AssetHandlerContract ? env.erc721AssetHandlerContract : "Not Deployed"}
    ----------------------------------------------------------------
    TrustlessAssetHandler:              ${env.trustlessAssetHandlerContract ? env.trustlessAssetHandlerContract : "Not Deployed"}
    ----------------------------------------------------------------
    Executor:                           ${env.exectorContract ? env.exectorContract : "Not Deployed"}
    ----------------------------------------------------------------
    Bridge:                             ${env.bridgeContract ? env.bridgeContract : "Not Deployed"}
    ----------------------------------------------------------------
    StakingFactory:                     ${env.stakingFactoryContract ? env.stakingFactoryContract : "Not Deployed"}
    ================================================================
            `)
}

main()
  .catch(console.error)
  .finally(() => process.exit());