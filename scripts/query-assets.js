// USAGE:
//  ENDPOINT=http://localhost:8545 node query-assets.js

require('dotenv').config();
const ethers = require('ethers');
const { waitForTx } = require('./utils.js');
const RegistryHubJson = require('../build/contracts/RegistryHub.json');
const TrustlessAssetHandlerJson = require('../build/contracts/TrustlessAssetHandler.json');
const Contracts = require('./contracts.json');

const RegistryHubAddress = Contracts.RegistryHub;
const AssetsOwner = '0xb182f4892397BF758179B220C881E32ce6EE32E2';
const BridgeAddress = Contracts.Bridge;
const TrustlessAssetHandlerAddress = Contracts.TrustlessAssetHandler;

async function main() {
    let env = {};
    env.url = process.env.ENDPOINT || 'http://localhost:8545';
    env.provider = new ethers.providers.JsonRpcProvider(env.url);

    const RegistryHub = new ethers.Contract(RegistryHubAddress, RegistryHubJson.abi, env.provider);
    const homeChainAsset = await RegistryHub.registryHub(AssetsOwner, 0);
    const steemHiveDelegateAsset = await RegistryHub.registryHub(AssetsOwner, 1);
    const substrateCrowdloanAsset = await RegistryHub.registryHub(AssetsOwner, 2);
    const substrateNominateAsset = await RegistryHub.registryHub(AssetsOwner, 3);

    console.log(`Assets registered by ${AssetsOwner}: `)
    console.log(`HomeChainAsset: ${homeChainAsset}`);
    console.log(`SteemHiveDelegateAsset: ${steemHiveDelegateAsset}`);
    console.log(`SubstrateCrowdloanAsset: ${substrateCrowdloanAsset}`);
    console.log(`SubstrateNominateAsset: ${substrateNominateAsset}`);
    console.log(`is trustless: ${await RegistryHub.isTrustless(substrateCrowdloanAsset)}`);

    // query balance in TrustlessAssetHandler
    const TrustlessAssetHandler = new ethers.Contract(TrustlessAssetHandlerAddress, TrustlessAssetHandlerJson.abi, env.provider);
    const source = ethers.utils.keccak256('0x' + BridgeAddress.substr(2) + substrateCrowdloanAsset.substr(2));
    const balance = await TrustlessAssetHandler.getBalance(source, AssetsOwner);
    console.log(`Balance of ${AssetsOwner}: ${balance}`);

    
}

main()
  .catch(console.error)
  .finally(() => process.exit());
