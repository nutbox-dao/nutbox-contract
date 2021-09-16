// USAGE: 
//  ENDPOINT=http://localhost:8545 KEY=<private key> GASLIMIT=10000000 GASPRICE=50000000000 node register-assets.js

require('dotenv').config();
const ethers = require('ethers');
const { waitForTx } = require('./utils.js');
const RegistryHubJson = require('../build/contracts/RegistryHub.json');
const HomeChainAssetRegistryJson = require('../build/contracts/HomeChainAssetRegistry.json');
const SteemHiveDelegateAssetRegistryJson = require('../build/contracts/SteemHiveDelegateAssetRegistry.json');
const SubstrateCrowdloanAssetRegistryJson = require('../build/contracts/SubstrateCrowdloanAssetRegistry.json');
const SubstrateNominateAssetRegistryJson = require('../build/contracts/SubstrateNominateAssetRegistry.json');
const SimpleERC20Json = require('../build/contracts/SimpleERC20.json');
const MintableERC20Json = require('../build/contracts/MintableERC20.json');
const ERC20FactoryJson = require('../build/contracts/ERC20Factory.json');
const Contracts = require('./contracts.json');

const RegistryHubAddress = Contracts.RegistryHub;
const HomeChainAssetRegistryAddress = Contracts.HomeChainAssetRegistry;
const SteemHiveDelegateAssetRegistryAddress = Contracts.SteemHiveDelegateAssetRegistry;
const SubstrateCrowdloanAssetRegistryAddress = Contracts.SubstrateCrowdloanAssetRegistry;
const SubstrateNominateAssetRegistryAddress = Contracts.SubstrateNominateAssetRegistry;

const ERC20FactoryAddress = Contracts.ERC20Factory;

async function isMintable(env, assetId) {
    const RegistryHub = new ethers.Contract(RegistryHubAddress, RegistryHubJson.abi, env.wallet);
    return await RegistryHub.mintable(assetId);
}
async function deployMintableERC20(env) {
    return new Promise(async (resolve, reject) => {
        const ERC20Factory = new ethers.Contract(ERC20FactoryAddress, ERC20FactoryJson.abi, env.wallet);
        ERC20Factory.on('ERC20TokenCreated', async (creator, name, symbol, tokenAddress, _isMintable) => {
            if(name == 'WALNUT' && _isMintable){
                console.log(tokenAddress, name, symbol, _isMintable);
                console.log("✓ Mintable ERC20 contract deployed", tokenAddress);
                resolve(tokenAddress)
                ERC20Factory.removeAllListeners('ERC20TokenCreated')
            }
        })
        const tx = await ERC20Factory.createERC20(
            "WALNUT", "NUT", 
            ethers.utils.parseUnits("10000.0", 18), 
            env.wallet.address,
            true,
            { gasPrice: env.gasPrice, gasLimit: env.gasLimit}
        )
    })
}

async function registerMintableERC20(env, mintabelERC20) {
    return new Promise(async (resolve, reject) => {
        const HomeChainAssetRegistry = new ethers.Contract(
            HomeChainAssetRegistryAddress, HomeChainAssetRegistryJson.abi, env.wallet
        );
        const tx0 = await HomeChainAssetRegistry.registerAsset(
            '0x', mintabelERC20, '0x',
            { gasPrice: env.gasPrice, gasLimit: env.gasLimit}
        );
        await waitForTx(env.provider, tx0.hash);
        HomeChainAssetRegistry.on('HomeChainAssetRegistered', async (sender, assetId, homeLocation) => {
            console.log("HomeChainAssetRegistered", assetId, homeLocation);
            resolve();
        })
    })
}

async function deployERC20(env, name, symbols) {
    return new Promise(async (resolve, reject) => {
        const ERC20Factory = new ethers.Contract(ERC20FactoryAddress, ERC20FactoryJson.abi, env.wallet);
        ERC20Factory.on('ERC20TokenCreated', (creator, _name, _symbol, _tokenAddress, isMintable) => {
            if(name == _name && !isMintable){
                console.log(_tokenAddress, _name, _symbol, isMintable);
                console.log("✓ Simple ERC20 contract deployed", _tokenAddress);
                resolve(_tokenAddress)
                ERC20Factory.removeAllListeners('ERC20TokenCreated')
            }
        })
        const tx = await ERC20Factory.createERC20(
            name, symbols, 
            ethers.utils.parseUnits("1000000000.0", 18), 
            env.wallet.address,
            false,
            { gasPrice: env.gasPrice, gasLimit: env.gasLimit}
        )
    })
}

async function registerERC20(env, erc20) {
    return new Promise(async (resolve, reject) => {
        const HomeChainAssetRegistry = new ethers.Contract(
            HomeChainAssetRegistryAddress, HomeChainAssetRegistryJson.abi, env.wallet
        );
        const tx0 = await HomeChainAssetRegistry.registerAsset(
            '0x', erc20, '0x',
            { gasPrice: env.gasPrice, gasLimit: env.gasLimit}
        );
        await waitForTx(env.provider, tx0.hash);
        HomeChainAssetRegistry.on('HomeChainAssetRegistered', async (sender, assetId, homeLocation) => {
            console.log("HomeChainAssetRegistered", assetId, homeLocation);
            resolve();
            HomeChainAssetRegistry.removeAllListeners('HomeChainAssetRegistered')
        })
    })
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

    await setWhitelist(env, HomeChainAssetRegistryAddress);
    await setWhitelist(env, SteemHiveDelegateAssetRegistryAddress);
    await setWhitelist(env, SubstrateCrowdloanAssetRegistryAddress);
    await setWhitelist(env, SubstrateNominateAssetRegistryAddress);
    await setWhitelist(env, ERC20FactoryAddress);
    return;

    // mintable asset registry
    const mintabelERC20 = await deployMintableERC20(env);
    await registerMintableERC20(env, mintabelERC20);
    
    // deploy erc20 contract
    // const simpleERC20 = await deployERC20(env);
    // await registerERC20(env, simpleERC20);

    // steem hive delegate asset registry
    const SteemHiveDelegateAssetRegistry = new ethers.Contract(
        SteemHiveDelegateAssetRegistryAddress, SteemHiveDelegateAssetRegistryJson.abi, env.wallet
    );
    //spec of foreignLocation:
    //  chainId             uint8   bytes[0]        1: Steem, 2: Hive
    //  assetType           bytes2  bytes[1, 2]     "sp"
    //  agentAccountLen     uint32  bytes[3, 6]
    //  agentAccount        bytes   bytes[7, end]
    const tx1 = await SteemHiveDelegateAssetRegistry.registerAsset(
        '0x0173700000000411223344', '0x0000000000000000000000000000000000000000', '0x',
        { gasPrice: env.gasPrice, gasLimit: env.gasLimit}
    );
    await waitForTx(env.provider, tx1.hash);

    // substrate crowdloan asset registry
    const SubstrateCrowdloanAssetRegistry = new ethers.Contract(
        SubstrateCrowdloanAssetRegistryAddress, SubstrateCrowdloanAssetRegistryJson.abi, env.wallet
    );

    //spec of foreignLocation:
    //      chainId             uint8       bytes[0]        2: Polkadot, 3: Kusama, 4,5,6,7 are reserved for other relaychain
    //      paraId              uint32      bytes[1, 4]
    //      trieIndex           uint32      bytes[5, 8]
    //      communityAccount    bytes32     bytes[9, end]
    const tx2 = await SubstrateCrowdloanAssetRegistry.registerAsset(
        '0x' + 
        ethers.utils.hexZeroPad(ethers.utils.hexlify(2), 1).substr(2) +     // chainId: polkadot
        ethers.utils.hexZeroPad(ethers.utils.hexlify(2004), 4).substr(2) +  // paraId: 2004
        ethers.utils.hexZeroPad(ethers.utils.hexlify(4), 4).substr(2) +     // trieIndex: 4
        ethers.utils.hexZeroPad(ethers.utils.hexlify(8), 32).substr(2),     // communityAccount         
        '0x0000000000000000000000000000000000000000',
        '0x',
        { gasPrice: env.gasPrice, gasLimit: env.gasLimit}
    );
    await waitForTx(env.provider, tx2.hash);

    // substrate nominate asset registry
    const SubstrateNominateAssetRegistry = new ethers.Contract(
        SubstrateNominateAssetRegistryAddress, SubstrateNominateAssetRegistryJson.abi, env.wallet
    );

    //spec of foreignLocation:
    //      chainId             uint8       bytes[0]        2: Polkadot, 3: Kusama, 4,5,6,7 are reserved for other relaychain
    //                                                      8-107 are reserved for FRAME based standalone chains
    //      validatorAccount    bytes32     bytes[1, end]
    const tx3 = await SubstrateNominateAssetRegistry.registerAsset(
        '0x' + 
        ethers.utils.hexZeroPad(ethers.utils.hexlify(2), 1).substr(2) +     // chainId: polkadot
        ethers.utils.hexZeroPad(ethers.utils.hexlify(8), 32).substr(2),     // validatorAccount        
        '0x0000000000000000000000000000000000000000',
        '0x',
        { gasPrice: env.gasPrice, gasLimit: env.gasLimit}
    );
    await waitForTx(env.provider, tx3.hash);
}

main()
  .catch(console.error)
  .finally(() => process.exit());
