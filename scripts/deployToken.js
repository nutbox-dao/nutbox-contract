require('dotenv').config();
const ethers = require('ethers');

const erc20Json = require('../build/contracts/MintableERC20.json')

async function deployTokenContract(env, name, symbol) {
    let factory = new ethers.ContractFactory(erc20Json.abi, erc20Json.bytecode, env.wallet);
    let contract = await factory.deploy(
        name,
        symbol,
        ethers.utils.parseUnits("20000000.0", 18),
        env.wallet.address,
        env.wallet.address
    );
    await contract.deployed();
    console.log("✓ Token deployed:", name, contract.address);
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

    let tx = await deployTokenContract(env, 'Peanut', 'PNUT');
    // await deployTokenContract(env, 'Ethereum Token', 'ETH');
    // await deployTokenContract(env, 'PancakeSwap Token', 'CAKE');
    // await deployTokenContract(env, 'BTCB Token', 'BTCB')
}

main()
  .catch(console.error)
  .finally(() => process.exit());