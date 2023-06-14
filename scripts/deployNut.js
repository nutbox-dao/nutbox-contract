require('dotenv').config();
const ethers = require('ethers');

const NUTTokenJson = require('../build/contracts/NUTToken.json');
const NUTAddress = '0x3a51Ac476B2505F386546450822F1bF9d881bEa4' // localhost
// const NUTAddress = '0xc821eC39fd35E6c8414A6C7B32674D51aD0c2468' // goerli
// const NUTAddress = '0x871AD5aAA75C297EB22A6349871ce4588E3c0306'  // BSC test

async function deployNutContract(env) {
    let factory = new ethers.ContractFactory(NUTTokenJson.abi, NUTTokenJson.bytecode, env.wallet);
    let contract = await factory.deploy(
        'Nutbox',
        'NUT',
        ethers.utils.parseUnits("0.0", 18),
        env.wallet.address
    );
    await contract.deployed();
    console.log("✓ NUTToken contract deployed", contract.address);
    return contract.address;
}
async function main() {
    let env = {};
    env.url = process.env.TESTENDPOINT || 'http://localhost:8545';
    env.privateKey = process.env.TESTKEY;
    env.provider = new ethers.providers.JsonRpcProvider(env.url);
    console.log(`private: ${env.privateKey}, url: ${env.url}`);
    env.wallet = new ethers.Wallet(env.privateKey, env.provider);
    env.gasLimit = ethers.utils.hexlify(Number(process.env.GASLIMIT));
    env.gasPrice = await env.provider.getGasPrice();

    const NUTAddress = await deployNutContract(env)

    const contract = new ethers.Contract(NUTAddress, NUTTokenJson.abi, env.wallet)
    const tx = await contract.enableTransfer();
    console.log(tx.hash);
}

main()
  .catch(console.error)
  .finally(() => process.exit());