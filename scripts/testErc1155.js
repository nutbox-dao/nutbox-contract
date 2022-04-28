const ERC1155Json = require('../build/contracts/ERC1155Token.json')
const ethers = require('ethers');
const { waitForTx } = require('./utils');
require('dotenv').config();

const erc1155 = '0x42aB1Da570fF1309E8d631945531966b830865e9' // test token on goerli

async function main() {
    let env = {}
    env.url = process.env.TESTENDPOINT;
    env.privateKey = process.env.TESTKEY;
    env.provider = new ethers.providers.JsonRpcProvider(env.url);
    env.wallet = new ethers.Wallet(env.privateKey, env.provider);
    env.gasPrice = await env.provider.getGasPrice();
    // env.gasPrice = env.gasPrice * 1.5
    console.log(`private: ${env.privateKey}, url: ${env.url}`);

    let factory = new ethers.ContractFactory(ERC1155Json.abi, ERC1155Json.bytecode, env.wallet);
    // let contract = await factory.deploy('test', {
    //     gasPrice: env.gasPrice
    // });
    // await contract.deployed();
    // console.log("✓ Erc1155 contract deployed", contract.address);
    // const token = contract.address;

    contract = new ethers.Contract(erc1155, ERC1155Json.abi, env.wallet);

    let tx = await contract.mint(env.wallet.address, 1, 100, '0x');
    await waitForTx(env.provider, tx.hash)
    tx = await contract.mint(env.wallet.address, 2, 1000, '0x');
    await waitForTx(env.provider, tx.hash)
    tx = await contract.mint(env.wallet.address, 3, 10000, '0x');
    await waitForTx(env.provider, tx.hash)

}

main();