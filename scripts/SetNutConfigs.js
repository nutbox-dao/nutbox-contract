require('dotenv').config();
const ethers = require('ethers');

const NUTTokenJson = require('../build/contracts/NUTToken.json');
const NUTAddress = '0x926E99b548e5D48Ca4C6215878b954ABd0f5D1f6'


async function enableTransfer(contract) {
    const tx = await contract.enableTransfer();
    console.log('Enable NUT Transfer', tx.hash);
}

async function disableTransfer(contract) {
    const tx = await contract.disableTransfer();
    console.log('Disable NUT Transfer', tx.hash);
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

   const contract = new ethers.Contract(NUTAddress, NUTTokenJson.abi, env.wallet)

   await enableTransfer(contract);
   

}

main()
  .catch(console.error)
  .finally(() => process.exit());