const ERC1155Json = require('../build/contracts/ERC1155Token.json')
const ethers = require('ethers');
const { waitForTx } = require('./utils');
require('dotenv').config();

const erc1155 = '0x94Cd64e037A14F9816C7b79A08C00299Fe4604A0' // test token on goerli

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
    let contract = await factory.deploy('test', {
        gasPrice: env.gasPrice
    });
    await contract.deployed();
    console.log("✓ Erc1155 contract deployed", contract.address);
    const token = contract.address;
    return;

    contract = new ethers.Contract(erc1155, ERC1155Json.abi, env.wallet);

    let tx = await contract.mint(env.wallet.address, 4, 100, '0x');
    // await waitForTx(env.provider, tx.hash)
    // tx = await contract.mint(env.wallet.address, 5, 1000, '0x');
    // await waitForTx(env.provider, tx.hash)
    // tx = await contract.mint(env.wallet.address, 6, 10000, '0x');
    // await waitForTx(env.provider, tx.hash)
    const b = await contract.isApprovedForAll('0x3d67A8926F097a1304eAF9Dc985fd00533Fa56C5', '0x735845971e3AC1a48159EB88efEd831D81Feec29')
    console.log(66, b);
}

main().catch(console.log);