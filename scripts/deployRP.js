require('dotenv').config();
const ethers = require('ethers');

const ReputationJson = require('../build/contracts/Reputation.json');
const { waitForTx } = require('./utils');

const contract = '0x383870Ae4E834155192cEce2fb5B0528CE0790E9'

async function deployRPContract(env) {
    let factory = new ethers.ContractFactory(ReputationJson.abi, ReputationJson.bytecode, env.wallet);
    let contract = await factory.deploy('https://test.web3id.pro', {
        gasPrice: env.gasPrice
    });
    await contract.deployed();
    console.log("✓ Reputation contract deployed", contract.address);
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

    const cc = new ethers.Contract(contract, ReputationJson.abi, env.wallet)
    let tx = await cc.grantRole('0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6', '0x0eb95E3E02Fc10CCFd6A4fF3eA9F29108fb5A2f6', {
        gasPrice: env.gasPrice
    })
    await waitForTx(env.provider, tx.hash)
    tx = await cc.grantRole('0xe97b137254058bd94f28d2f3eb79e2d34074ffb488d042e3bc958e0a57d2fa22', '0x0eb95E3E02Fc10CCFd6A4fF3eA9F29108fb5A2f6', {
        gasPrice: env.gasPrice
    })
    await waitForTx(env.provider, tx.hash)
}

main()
  .catch(console.error)
  .finally(() => process.exit());