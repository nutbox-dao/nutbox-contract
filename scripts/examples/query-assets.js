// USAGE:
//  ENDPOINT=http://localhost:8545 node query-assets.js

require('dotenv').config();
const ethers = require('ethers');
const { waitForTx } = require('../utils.js');
const RegistryHubJson = require('../../build/contracts/RegistryHub.json');
const Contracts = require('../contracts.json');

const RegistryHubAddress = Contracts.RegistryHub;
const AssetsOwner = '0x03bAb49C10c93f123eeE13b82adc55d1B07C9fb2';

async function main() {
    let env = {};
    env.url = process.env.ENDPOINT || 'http://localhost:8545';
    env.provider = new ethers.providers.JsonRpcProvider(env.url);

    const RegistryHub = new ethers.Contract(RegistryHubAddress, RegistryHubJson.abi, env.provider);

    const homeChainAsset = await RegistryHub.registryHub(AssetsOwner, 0);
    const steemHiveDelegateAsset = await RegistryHub.registryHub(AssetsOwner, 1);
    const substrateCrowdloanAsset = await RegistryHub.registryHub(AssetsOwner, 2);
    const substrateNominateAsset = await RegistryHub.registryHub(AssetsOwner, 2);

    console.log(`Assets registered by ${AssetsOwner}: `)
    console.log(`HomeChainAsset: ${homeChainAsset}`);
    console.log(`SteemHiveDelegateAsset: ${steemHiveDelegateAsset}`);
    console.log(`SubstrateCrowdloanAsset: ${substrateCrowdloanAsset}`);
    console.log(`SubstrateNominateAsset: ${substrateNominateAsset}`);
}

main()
  .catch(console.error)
  .finally(() => process.exit());
