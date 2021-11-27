require('dotenv').config();
const ethers = require('ethers');
const fs = require("fs");

const EmptyJson = require('../build/contracts/Empty.json');
const erc20AssetHandlerJson = require('../build/contracts/ERC20AssetHandler.json')
const erc20AssetHandlerAddress = require('./contracts.json').ERC20AssetHandler

async function main() {
    let env = {};
    env.url = process.env.ENDPOINT || 'http://localhost:8545';
    env.privateKey = process.env.KEY;
    env.provider = new ethers.providers.JsonRpcProvider(env.url);
    console.log(`private: ${env.privateKey}, url: ${env.url}`);
    env.wallet = new ethers.Wallet(env.privateKey, env.provider);
    env.gasLimit = ethers.utils.hexlify(Number(process.env.GASLIMIT));
    env.gasPrice = await env.provider.getGasPrice();

    const contract = new ethers.Contract(erc20AssetHandlerAddress, erc20AssetHandlerJson.abi, env.wallet);
    try {
        // const tx = await contract.renounceRole('0x0000000000000000000000000000000000000000000000000000000000000000', env.wallet.address);
        const tx = await contract.setRegistryHub('0xCf1f551a9eE0270275416a73ae8Af7180F4FFbDf', {
            gasPrice: env.gasPrice,
            gasLimit: env.gasLimit
        });
        console.log('renounceRole admin of erc20handler', tx);
        // hash: 0x0b44289cb3bf84f19ff9612ab152005cd8b2687a844b12210633032e1a22aded
    } catch (error) {
        console.log(error);
    }
}

main()
    .catch(console.error)
    .finally(() => process.exit());
