/** 
 * Deploy and Register official tokens 
 * We always use exist tokens in some mainnet.So only need to register them to asset is ok
 */


require('dotenv').config();
const ethers = require('ethers');
const { waitForTx } = require('./utils.js');
const HomeChainAssetRegistryJson = require('../build/contracts/HomeChainAssetRegistry.json');
const ERC20FactoryJson = require('../build/contracts/ERC20Factory.json');
const RegistryHubJson = require('../build/contracts/RegistryHub.json')
const Contracts = require('./contracts.json');

const HomeChainAssetRegistryAddress = Contracts.HomeChainAssetRegistry;
const ERC20FactoryAddress = Contracts.ERC20Factory;
const RegistryHubAddress = Contracts.RegistryHub;

async function deployERC20(env, name, symbols) {
    return new Promise(async (resolve, reject) => {
        const ERC20Factory = new ethers.Contract(ERC20FactoryAddress, ERC20FactoryJson.abi, env.wallet);
        ERC20Factory.on('ERC20TokenCreated', (creator, _name, _symbol, _tokenAddress, isMintable) => {
            if(name == _name){
                console.log(_tokenAddress, _name, _symbol, isMintable);
                console.log("✓ Simple ERC20 contract deployed", _tokenAddress);
                ERC20Factory.removeAllListeners('ERC20TokenCreated')
                resolve(_tokenAddress)
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
        HomeChainAssetRegistry.on('HomeChainAssetRegistered', async (sender, assetId, homeLocation) => {
            if (erc20 === homeLocation){
                console.log("HomeChainAssetRegistered", assetId, homeLocation);
                HomeChainAssetRegistry.removeAllListeners('HomeChainAssetRegistered')
                resolve(assetId);
            }
        })
        const tx0 = await HomeChainAssetRegistry.registerAsset(
            '0x', erc20, '0x',
            { gasPrice: env.gasPrice, gasLimit: env.gasLimit}
        );
    })
}

async function main() {
    let env = {};
    env.url = process.env.ENDPOINT || 'http://localhost:8545';
    env.privateKey = process.env.KEY;
    env.provider = new ethers.providers.JsonRpcProvider(env.url);
    env.wallet = new ethers.Wallet(env.privateKey, env.provider);
    env.gasLimit = ethers.utils.hexlify(Number(process.env.GASLIMIT));
    env.gasPrice = ethers.utils.hexlify(Number(process.env.GASPRICE));

    // const WETH = await deployERC20(env, 'WETH', 'WETH');
    const NUT = await deployERC20(env, 'Nutbox', 'NUT');

    let nutAssetId = await registerERC20(env, NUT);
    // nutAssetId = "0x8fc392966ab8ae661c101da3cac00722d172319b137266ecaca375f7f90838e8"// await registerERC20(env, '0x61b053807fBD95d1e187cd3Ed98c9abf2CEED62a');

    // set nut staking
    const registryHub = new ethers.Contract(RegistryHubAddress, RegistryHubJson.abi, env.wallet);
    console.log('NUT asset ID', nutAssetId);
    await registryHub.setNUTStaking(nutAssetId, ethers.utils.parseUnits("10.0", 18));
}

main()
  .catch(console.error)
  .finally(() => process.exit());
