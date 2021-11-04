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
    env.gasPrice = await env.provider.getGasPrice();

    // const WETH = await deployERC20(env, 'WETH', 'WETH');
    // const NUT ='0x4429FcdD4eC4EA4756B493e9c0525cBe747c2745'// await deployERC20(env, 'Nutbox', 'NUT');
    // const WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
    // const ETH = '0x2170Ed0880ac9A755fd29B2688956BD959F933F8';
    // const CAKE = '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82';
    // const BTCB = '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c';
    // const MINT = '0x1f3Af095CDa17d63cad238358837321e95FC5915';
    const mintGrant = '0x58764cE77f0140F9678bA6dED9D9697c979F4E0f';
    const mintDao = '0x558810B46101DE82b579DD1950E9C717dCc28338';
    const mintCreator = '0x9f3C60dC06f66b3e0ea1Eb05866F9c1A74d43D67';

    // let nutAssetId = await registerERC20(env, NUT);
    // let bnbAsset = await registerERC20(env, WBNB);
    // let ethAsset = await registerERC20(env, ETH);
    // let cakeAsset = await registerERC20(env, CAKE);
    // let btcAsset = await registerERC20(env, BTCB);
    // let mintAsset = await registerERC20(env, MINT);
    let mintGrantAsset = await registerERC20(env, mintGrant);
    let mintDaoAsset = await registerERC20(env, mintDao);
    let mintCreatorAsset = await registerERC20(env, mintCreator);

    console.log({mintGrantAsset,mintDaoAsset,mintCreatorAsset});
    return;
    console.log('assetsId', {
        nutAssetId,
        bnbAsset,
        ethAsset,
        cakeAsset,
        btcAsset
    });
    // set nut staking
    const registryHub = new ethers.Contract(RegistryHubAddress, RegistryHubJson.abi, env.wallet);
    console.log('NUT asset ID', nutAssetId);
    await registryHub.setNUTStaking(nutAssetId, ethers.utils.parseUnits("0.0", 18));
}

main()
  .catch(console.error)
  .finally(() => process.exit());