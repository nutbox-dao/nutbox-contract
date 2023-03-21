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

    await contract.grantRole("0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6",
        "0xFc04ED11A807A0B9A9fc23d4E76D6C8e87170E1a", { gasPrice: env.gasPrice });
    console.log("✓ Set the minter");
}

main()
    .catch(console.error)
    .finally(() => process.exit());