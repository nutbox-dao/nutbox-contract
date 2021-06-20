// USAGE: 
//  ENDPOINT=http://localhost:8545 KEY=<private key> GASLIMIT=10000000 GASPRICE=50000000000 node register-assets.js

require('dotenv').config();
const ethers = require('ethers');
const { waitForTx } = require('../utils.js');
const RegistryHubJson = require('../../build/contracts/RegistryHub.json');
const HomeChainAssetRegistryJson = require('../../build/contracts/HomeChainAssetRegistry.json');
const SteemHiveDelegateAssetRegistryJson = require('../../build/contracts/SteemHiveDelegateAssetRegistry.json');
const SubstrateCrowdloanAssetRegistryJson = require('../../build/contracts/SubstrateCrowdloanAssetRegistry.json');
const SubstrateNominateAssetRegistryJson = require('../../build/contracts/SubstrateNominateAssetRegistry.json');
const SimpleERC20Json = require('../../build/contracts/SimpleERC20.json');
const Contracts = require('../contracts.json');

const RegistryHubAddress = Contracts.RegistryHub;
const HomeChainAssetRegistryAddress = Contracts.HomeChainAssetRegistry;
const SteemHiveDelegateAssetRegistryAddress = Contracts.SteemHiveDelegateAssetRegistry;
const SubstrateCrowdloanAssetRegistryAddress = Contracts.SubstrateCrowdloanAssetRegistry;
const SubstrateNominateAssetRegistryAddress = Contracts.SubstrateNominateAssetRegistry;

async function deployERC20(env) {
    const factory = new ethers.ContractFactory(SimpleERC20Json.abi, SimpleERC20Json.bytecode, env.wallet);
    const contract = await factory.deploy(
        "TestCoin", "TC", ethers.BigNumber.from('1000000000'), env.wallet.address,
        { gasPrice: env.gasPrice, gasLimit: env.gasLimit}
    );
    await contract.deployed();
    env.simpleERC20Contract = contract.address;
    console.log("✓ Simple ERC20 contract deployed");
}

async function setWhitelist(env, address) {
    const RegistryHub = new ethers.Contract(RegistryHubAddress, RegistryHubJson.abi, env.wallet);
    const tx = await RegistryHub.setWhiteList(
        address,
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

    // deploy erc20 contract
    await deployERC20(env);

    await setWhitelist(env, HomeChainAssetRegistryAddress);
    await setWhitelist(env, SteemHiveDelegateAssetRegistryAddress);
    await setWhitelist(env, SubstrateCrowdloanAssetRegistryAddress);
    await setWhitelist(env, SubstrateNominateAssetRegistryAddress);

    // home chain asset registry
    const HomeChainAssetRegistry = new ethers.Contract(
        HomeChainAssetRegistryAddress, HomeChainAssetRegistryJson.abi, env.wallet
    );
    const tx = await HomeChainAssetRegistry.registerAsset(
        '0x', env.simpleERC20Contract, '0x',
        { gasPrice: env.gasPrice, gasLimit: env.gasLimit}
    );
    await waitForTx(env.provider, tx.hash);

    // steem hive delegate asset registry
    const SteemHiveDelegateAssetRegistry = new ethers.Contract(
        SteemHiveDelegateAssetRegistryAddress, SteemHiveDelegateAssetRegistryJson.abi, env.wallet
    );
    //spec of foreignLocation:
    //  chainId             uint8   bytes[0]        1: Steem, 2: Hive
    //  assetType           bytes2  bytes[1, 2]     "sp"
    //  agentAccountLen     uint32  bytes[3, 6]
    //  agentAccount        bytes   bytes[7, end]
    const tx = await SteemHiveDelegateAssetRegistry.registerAsset(
        '0x0173700000000411223344', '0x0000000000000000000000000000000000000000', '0x',
        { gasPrice: env.gasPrice, gasLimit: env.gasLimit}
    );
    await waitForTx(env.provider, tx.hash);

    // substrate crowdloan asset registry
    const SubstrateCrowdloanAssetRegistry = new ethers.Contract(
        SubstrateCrowdloanAssetRegistryAddress, SubstrateCrowdloanAssetRegistryJson.abi, env.wallet
    );

    //spec of foreignLocation:
    //      chainId             uint8       bytes[0]        2: Polkadot, 3: Kusama, 4,5,6,7 are reserved for other relaychain
    //      paraId              uint32      bytes[1, 4]
    //      trieIndex           uint32      bytes[5, 8]
    //      communityAccount    bytes32     bytes[9, end]
    const tx = await SubstrateCrowdloanAssetRegistry.registerAsset(
        '0x' + 
        ethers.utils.hexZeroPad(ethers.utils.hexlify(2), 1).substr(2) +     // chainId: polkadot
        ethers.utils.hexZeroPad(ethers.utils.hexlify(2004), 4).substr(2) +  // paraId: 2004
        ethers.utils.hexZeroPad(ethers.utils.hexlify(4), 4).substr(2) +     // trieIndex: 4
        ethers.utils.hexZeroPad(ethers.utils.hexlify(8), 32).substr(2),     // communityAccount         
        '0x0000000000000000000000000000000000000000',
        '0x',
        { gasPrice: env.gasPrice, gasLimit: env.gasLimit}
    );
    await waitForTx(env.provider, tx.hash);

    // substrate nominate asset registry
    const SubstrateNominateAssetRegistry = new ethers.Contract(
        SubstrateNominateAssetRegistryAddress, SubstrateNominateAssetRegistryJson.abi, env.wallet
    );

    //spec of foreignLocation:
    //      chainId             uint8       bytes[0]        2: Polkadot, 3: Kusama, 4,5,6,7 are reserved for other relaychain
    //                                                      8-107 are reserved for FRAME based standalone chains
    //      validatorAccount    bytes32     bytes[1, end]
    const tx = await SubstrateNominateAssetRegistry.registerAsset(
        '0x' + 
        ethers.utils.hexZeroPad(ethers.utils.hexlify(2), 1).substr(2) +     // chainId: polkadot
        ethers.utils.hexZeroPad(ethers.utils.hexlify(8), 32).substr(2),     // validatorAccount        
        '0x0000000000000000000000000000000000000000',
        '0x',
        { gasPrice: env.gasPrice, gasLimit: env.gasLimit}
    );
    await waitForTx(env.provider, tx.hash);
}

main()
  .catch(console.error)
  .finally(() => process.exit());
