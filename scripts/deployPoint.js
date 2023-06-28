require('dotenv').config();
const ethers = require('ethers');

const PointJson = require('../build/contracts/Point.json');

async function deployPointContract(env, name, symbol) {
    let factory = new ethers.ContractFactory(PointJson.abi, PointJson.bytecode, env.wallet);
    let contract = await factory.deploy(
        name,
        symbol,
        ethers.utils.parseUnits("1000000000.0", 18),
        env.wallet.address,
        { gasPrice: env.gasPrice, gasLimit: env.gasLimit}
    );
    await contract.deployed();
    console.log("✓ Point contract deployed", contract.address);
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

    const pointAddress = await deployPointContract(env, 'Wormhole3 CH', 'wCH')

    const contract = new ethers.Contract(pointAddress, PointJson.abi, env.wallet)
    const tx = await contract.setWhiteList('');
    console.log(tx.hash);
}

main()
  .catch(console.error)
  .finally(() => process.exit());