require('dotenv').config();
const ethers = require('ethers');
const { getEnv, deployContract } = require('./utils');

const Untradable721Json = require('../build/contracts/Untradable721.json');

async function main() {
    let env = await getEnv();
    await deployContract(env, Untradable721Json, ["WordCloud", "WC"]);
    let chainId = env.provider._network.chainId;
    let address = Untradable721Json.networks[chainId].address
    const contract = new ethers.Contract(address, Untradable721Json.abi, env.wallet);
    await contract.setBaseURI("https://gateway.nutbox.app/ipfs/");
    console.log("✓ Set the base URI");
}

main()
    .catch(console.error)
    .finally(() => process.exit());