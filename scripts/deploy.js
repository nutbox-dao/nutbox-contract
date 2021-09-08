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
const ERC20FactoryJson = require('../build/contracts/ERC20Factory.json');
const SimpleERC20Json = require('../build/contracts/SimpleERC20.json');
const LinearCalculatorJson = require('../build/contracts/LinearCalculator.json');

async function deployRegistryHubContract(env) {
    let factory = new ethers.ContractFactory(RegistryHubJson.abi, RegistryHubJson.bytecode, env.wallet);
    let contract = await factory.deploy(
        { gasPrice: env.gasPrice, gasLimit: env.gasLimit}
    );
    await contract.deployed();
    env.registryHubContract = contract.address;
    console.log("✓ RegistryHub contract deployed", contract.address);
}

async function deployERC20Factory(env) {
    const factory = new ethers.ContractFactory(ERC20FactoryJson.abi, ERC20FactoryJson.bytecode, env.wallet);
    const contract = await factory.deploy(
        env.registryHubContract,
        { gasPrice: env.gasPrice, gasLimit: env.gasLimit}
    )
    await contract.deployed();
    env.erc20RactoryContract = contract.address;
    console.log('✓ ERC20FActory contract depoloyed', contract.address);
}

async function deployHomeChainAssetRegistryContract(env) {
    let factory = new ethers.ContractFactory(HomeChainAssetRegistryJson.abi, HomeChainAssetRegistryJson.bytecode, env.wallet);
    let contract = await factory.deploy(
        env.registryHubContract,
        env.erc20RactoryContract,
        { gasPrice: env.gasPrice, gasLimit: env.gasLimit}
    );
    await contract.deployed();
    env.homeChainAssetRegistryContract = contract.address;
    console.log("✓ HomeChainAssetRegistry contract deployed", contract.address);
}

async function deploySteemHiveDelegateAssetRegistryContract(env) {
    let factory = new ethers.ContractFactory(SteemHiveDelegateAssetRegistryJson.abi, SteemHiveDelegateAssetRegistryJson.bytecode, env.wallet);
    let contract = await factory.deploy(
        env.registryHubContract,
        { gasPrice: env.gasPrice, gasLimit: env.gasLimit}
    );
    await contract.deployed();
    env.steemHiveDelegateAssetRegistryContract = contract.address;
    console.log("✓ SteemHiveDelegateAssetRegistry contract deployed", contract.address);
}

async function deploySubstrateCrowdloanAssetRegistryContract(env) {
    let factory = new ethers.ContractFactory(SubstrateCrowdloanAssetRegistryJson.abi, SubstrateCrowdloanAssetRegistryJson.bytecode, env.wallet);
    let contract = await factory.deploy(
        env.registryHubContract,
        { gasPrice: env.gasPrice, gasLimit: env.gasLimit}
    );
    await contract.deployed();
    env.substrateCrowdloanAssetRegistryContract = contract.address;
    console.log("✓ SubstrateCrowdloanAssetRegistry contract deployed", contract.address);
}

async function deploySubstrateNominateAssetRegistryContract(env) {
    let factory = new ethers.ContractFactory(SubstrateNominateAssetRegistryJson.abi, SubstrateNominateAssetRegistryJson.bytecode, env.wallet);
    let contract = await factory.deploy(
        env.registryHubContract,
        { gasPrice: env.gasPrice, gasLimit: env.gasLimit}
    );
    await contract.deployed();
    env.substrateNominateAssetRegistryContract = contract.address;
    console.log("✓ SubstrateNominateAssetRegistry contract deployed", contract.address);
}

async function deployExecutorContract(env) {
    let factory = new ethers.ContractFactory(ExectorJson.abi, ExectorJson.bytecode, env.wallet);
    let contract = await factory.deploy(
        env.registryHubContract,
        { gasPrice: env.gasPrice, gasLimit: env.gasLimit}
    );
    await contract.deployed();
    env.executorContract = contract.address;
    console.log("✓ Proposal Exector contract deployed", contract.address);
}

async function deployBridgeContract(env) {
    let factory = new ethers.ContractFactory(BridgeJson.abi, BridgeJson.bytecode, env.wallet);
    let contract = await factory.deploy(
        env.registryHubContract,
        env.executorContract,
        ethers.utils.parseEther(env.bridgeFee.toString()),
        env.bridgeExpiry,
        { gasPrice: env.gasPrice, gasLimit: env.gasLimit}

    );
    await contract.deployed();
    env.bridgeContract = contract.address;
    console.log("✓ Bridge contract deployed", contract.address);
}

async function deployERC20AssetHandlerContract(env) {
    let factory = new ethers.ContractFactory(ERC20AssetHandlerJson.abi, ERC20AssetHandlerJson.bytecode, env.wallet);
    let contract = await factory.deploy(
        env.registryHubContract,
        { gasPrice: env.gasPrice, gasLimit: env.gasLimit}

    );
    await contract.deployed();
    env.erc20AssetHandlerContract = contract.address;
    console.log("✓ ERC20AssetHandler contract deployed", contract.address);
}

async function deployTrustlessAssetHandlerContract(env) {
    let factory = new ethers.ContractFactory(TrustlessAssetHandlerJson.abi, TrustlessAssetHandlerJson.bytecode, env.wallet);
    let contract = await factory.deploy(
        env.registryHubContract,
        env.executorContract,
        { gasPrice: env.gasPrice, gasLimit: env.gasLimit}
    );
    await contract.deployed();
    env.trustlessAssetHandlerContract = contract.address;
    console.log("✓ TrustlessAssetHandler contract deployed", contract.address);
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
    console.log("✓ StakingFactory contract deployed", contract.address);
}

async function deployERC20(env) {
    const factory = new ethers.ContractFactory(SimpleERC20Json.abi, SimpleERC20Json.bytecode, env.wallet);
    const contract = await factory.deploy("", "", { gasPrice: env.gasPrice, gasLimit: env.gasLimit});
    await contract.deployed();
    env.simpleERC20Contract = contract.address;
    console.log("✓ Simple ERC20 contract deployed", contract.address);
}

async function deployLinearCalculator(env) {
    const factory = new ethers.ContractFactory(LinearCalculatorJson.abi, LinearCalculatorJson.bytecode, env.wallet);
    const contract = await factory.deploy({ gasPrice: env.gasPrice, gasLimit: env.gasLimit});
    await contract.deployed();
    env.linearCalculatorContract = contract.address;
    console.log("✓ LinearCalculator contract deployed", contract.address);
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
    // env.registryHubContract = '0x4c99C3FaFAe0B83920fC4eb3370CB0a6541DA847'
    // env.erc20RactoryContract = '0x97bCDCA82c845bAb4d8D7Cf2B0f7F56D29348e15'
    // env.homeChainAssetRegistryContract = '0xB7fF6a7725b4d979bd95Be37bA631C56A5f35dCe'
    // env.steemHiveDelegateAssetRegistryContract = '0x411BcCae82e6DA69D6E29ef44C3fCa2f3ff2bB33'
    // env.substrateCrowdloanAssetRegistryContract = '0x5B353D9e16A9d1a70Ecf89655810AB5B7E34984E'
    // env.substrateNominateAssetRegistryContract = '0xb693Daa5879aeBfbC45433d1d4cdae78d5e7c657'
    // env.executorContract = '0x8a4c371AEC232A69Eb41863e109f558F50B6682d'
    // env.bridgeContract = '0xd07E6F1bb68F745694a58aBdFb3B5152B5f11F06'
    // env.erc20AssetHandlerContract = '0x050222CA9BE1921AA332b5bF228D4af947407F24'
    // env.trustlessAssetHandlerContract = '0x2C366DAF7eA176b9ef782499bA45787B04765391'
    // env.stakingFactoryContract = '0x37d256Dbac122a83f40E766073aF71334105dDc0'
    // env.linearCalculatorContract = '0x33de6235522d64bFc4736f8A302B91EB44330585'
    await deployRegistryHubContract(env);
    await deployERC20Factory(env);
    await deployHomeChainAssetRegistryContract(env);
    await deploySteemHiveDelegateAssetRegistryContract(env);
    await deploySubstrateCrowdloanAssetRegistryContract(env);
    await deploySubstrateNominateAssetRegistryContract(env);

    // deploy bridge contract
    await deployExecutorContract(env);
    await deployBridgeContract(env);

    // deploy asset handlers
    await deployERC20AssetHandlerContract(env);
    await deployTrustlessAssetHandlerContract(env);

    // registryHub set asset handlers
    const registryHub = new ethers.Contract(env.registryHubContract, RegistryHubJson.abi, env.wallet);
    await registryHub.setAssetHandlers(env.erc20AssetHandlerContract, '0x0000000000000000000000000000000000000000', env.trustlessAssetHandlerContract);
    console.log('RegistryHub has set asset handlers');

    // exector set bridge
    const executor = new ethers.Contract(env.executorContract, ExectorJson.abi, env.wallet);
    await executor.adminSetBridge(env.bridgeContract);
    console.log('Executor has set bridge');

    // deploy staking factory contract
    await deployStakingFactoryContract(env);
    // deploy staking reward calculators
    await deployLinearCalculator(env);
    // set StakingFactory into calculators
    const linearCalculator = new ethers.Contract(env.linearCalculatorContract, LinearCalculatorJson.abi, env.wallet);
    await linearCalculator.adminSetStakingFactory(env.stakingFactoryContract);
    console.log('Set StakingFactory into LinearCalculator');

    // set StakingFactory as whitelist manager of ERC20AssetHandler
    const erc20AssetHandler = new ethers.Contract(env.erc20AssetHandlerContract, ERC20AssetHandlerJson.abi, env.wallet);
    await erc20AssetHandler.adminAddWhitelistManager(env.stakingFactoryContract);
    console.log('Set StakingFactory as whitelist manager of ERC20AssetHandler');

    // set StakingFactory as whitelist manager of TrustlessAssetHandler
    const trustlessAssetHandler = new ethers.Contract(env.trustlessAssetHandlerContract, TrustlessAssetHandlerJson.abi, env.wallet);
    await trustlessAssetHandler.adminAddWhitelistManager(env.stakingFactoryContract);
    console.log('Set StakingFactory as whitelist manager of TrustlessAssetHandler');

    // add Executor into whitelist of ERC20AssetHandler
    await erc20AssetHandler.setWhitelist(env.executorContract);
    console.log('Add Executor into whitelist of ERC20AssetHandler');

    // add Executor into whitelist of TrustlessAssetHandler
    await trustlessAssetHandler.setWhitelist(env.executorContract);
    console.log('Add Executor into whitelist of TrustlessAssetHandler');

    // TODO: add Executor into whitelist of ERC721AssetHandler

    let deployCost = startBalance.sub((await env.provider.getBalance(env.wallet.address)))

    // dump to local file
    const output = {
        RegistryHub: env.registryHubContract ? env.registryHubContract : "Not Deployed",
        ERC20Factory: env.erc20RactoryContract ?? "Not Deployed",
        HomeChainAssetRegistry: env.homeChainAssetRegistryContract ? env.homeChainAssetRegistryContract : "Not Deployed",
        SteemHiveDelegateAssetRegistry: env.steemHiveDelegateAssetRegistryContract ? env.steemHiveDelegateAssetRegistryContract : "Not Deployed",
        SubstrateCrowdloanAssetRegistry: env.substrateCrowdloanAssetRegistryContract ? env.substrateCrowdloanAssetRegistryContract : "Not Deployed",
        SubstrateNominateAssetRegistry: env.substrateNominateAssetRegistryContract ? env.substrateNominateAssetRegistryContract : "Not Deployed",
        ERC20AssetHandler: env.erc20AssetHandlerContract ? env.erc20AssetHandlerContract : "Not Deployed",
        ERC721AssetHandler: env.erc721AssetHandlerContract ? env.erc721AssetHandlerContract : "Not Deployed",
        TrustlessAssetHandler: env.trustlessAssetHandlerContract ? env.trustlessAssetHandlerContract : "Not Deployed",
        Executor:  env.executorContract ? env.executorContract : "Not Deployed",
        Bridge: env.bridgeContract ? env.bridgeContract : "Not Deployed",
        StakingFactory: env.stakingFactoryContract ? env.stakingFactoryContract : "Not Deployed",
        LinearCalculator: env.linearCalculatorContract ? env.linearCalculatorContract: "Not Deployed"
    };
    
    const outfile = './scripts/contracts.json'
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
        ERC20Factory:                     ${env.erc20RactoryContract ?? "Not Deployed"}
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
        Executor:                           ${env.executorContract ? env.executorContract : "Not Deployed"}
        ----------------------------------------------------------------
        Bridge:                             ${env.bridgeContract ? env.bridgeContract : "Not Deployed"}
        ----------------------------------------------------------------
        StakingFactory:                     ${env.stakingFactoryContract ? env.stakingFactoryContract : "Not Deployed"}
        ----------------------------------------------------------------
        LinearCalculator:                   ${env.linearCalculatorContract ? env.linearCalculatorContract : "Not Deployed"}
        ================================================================
    `)
}

main()
  .catch(console.error)
  .finally(() => process.exit());