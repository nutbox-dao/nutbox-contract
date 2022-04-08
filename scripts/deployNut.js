require('dotenv').config();
const ethers = require('ethers');

const NUTTokenJson = require('../build/contracts/NUTToken.json');
const { waitForTx } = require('./utils');
const NUTAddress = '0xc821eC39fd35E6c8414A6C7B32674D51aD0c2468' // localhost
// const NUTAddress = '0xc821eC39fd35E6c8414A6C7B32674D51aD0c2468' // goerli
// const NUTAddress = '0x871AD5aAA75C297EB22A6349871ce4588E3c0306'  // BSC test

async function deployNutContract(env) {
    let factory = new ethers.ContractFactory(NUTTokenJson.abi, NUTTokenJson.bytecode, env.wallet);
    let contract = await factory.deploy(
        'Nutbox',
        'NUT',
        ethers.utils.parseUnits("200000000.0", 18),
        env.wallet.address
    );
    await contract.deployed();
    console.log("✓ NUTToken contract deployed", contract.address);
    return contract.address;
}

const accounts = [
    '0xd0ba32cBB33dd58e55dBC2A243339A331145660B',
    '0xA54Ea35D869eb5A61228b5d252CC4da812837A0F',
    '0x5A052c31F05D391BD13270132c6be1018de84F05',
    '0x6CA444FA1066FBC0d73b982Fb7EeA6cc2a7C53aE',
    '0xcaa66d56c86Bc2d618d3920246CD1cac59580351'
]

async function main() {
    let env = {};
    env.url = process.env.TESTENDPOINT || 'http://localhost:8545';
    env.privateKey = process.env.TESTKEY;
    env.provider = new ethers.providers.JsonRpcProvider(env.url);
    console.log(`private: ${env.privateKey}, url: ${env.url}`);
    env.wallet = new ethers.Wallet(env.privateKey, env.provider);
    env.gasLimit = ethers.utils.hexlify(Number(process.env.GASLIMIT));
    env.gasPrice = await env.provider.getGasPrice();

    // const NUTAddress = await deployNutContract(env)

    const contract = new ethers.Contract(NUTAddress, NUTTokenJson.abi, env.wallet)

    // const tx = await contract.enableTransfer();
    // await waitForTx(env.provider, tx.hash)
    // console.log(tx.hash);
    const amount = ethers.utils.parseUnits('10000', 18)
    for (let acc of accounts){
        const tx = await contract.transfer(acc, amount);
        await waitForTx(env.provider, tx.hash)
        console.log('Transfer nut to', acc);
    }
}

main()
  .catch(console.error)
  .finally(() => process.exit());