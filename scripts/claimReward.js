require('dotenv').config();
const ethers = require('ethers');
const { waitForTx, sleep } = require('./utils')

const Web3IdJson = require('../build/contracts/Web3Id.json');
const curationJson = require('../build/contracts/AutoCuration.json')

const web3id = '0xc19100159c7f6C723152842d00f9F01487Ab85aA'

const MINTER_ROLE = '0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6'
const DEFAULT_ADMIN_ROLE = '0x0000000000000000000000000000000000000000000000000000000000000000'
const TRANSFER_ROLE = '0x8502233096d909befbda0999bb8ea2f3a6be3c138b9fbf003752a4c8bce86f6c'
const BURN_ROLE = '0xe97b137254058bd94f28d2f3eb79e2d34074ffb488d042e3bc958e0a57d2fa22'

async function main () {
    let env = {};
    env.url = process.env.ARBITRUM || 'http://localhost:8545';
    env.privateKey = process.env.CLAIM_KEY;
    env.provider = new ethers.providers.JsonRpcProvider(env.url);
    console.log(`private: ${env.privateKey}, url: ${env.url}`);
    env.wallet = new ethers.Wallet(env.privateKey, env.provider);
    env.gasLimit = ethers.utils.hexlify(Number(process.env.GASLIMIT));
    env.gasPrice = await env.provider.getGasPrice();
    console.log(2354, env.gasPrice.toString(), env.wallet.address);

    const contract = '0xCa1893F7E9a5f78A6Ed7C0Aff29584432B453A94';
    const autoCuration = new ethers.Contract(contract, curationJson.abi, env.wallet)
    console.log(await autoCuration.signAddress());
    let twitterId = '3217862392435'
    let ids = ["0x33ecef1f6b0823662714be1a"]
    let amounts = [ethers.utils.parseEther('50')]
    try {
        const tx = await autoCuration.claimPrize(twitterId, env.wallet.address, ids, amounts[0], await signMessage(twitterId, 42161, env.wallet.address, ids, amounts))
        await tx.wait();
        console.log(tx.hash)
    } catch (error) {
        console.error(33, error)
    }
}

async function signMessage(twitterId, chainId, receiver, cids, amounts) {
    let provider = new ethers.providers.JsonRpcProvider(process.env.ARBITRUM);
    let wallet = new ethers.Wallet(process.env.MAIN_KEY, provider);
    let data = ethers.utils.solidityKeccak256(["uint256", "uint256", "address", "uint256[]", "uint256[]"], [twitterId, chainId, receiver, cids, amounts])
    data = ethers.utils.arrayify(data);
    let sig = await wallet.signMessage(data);
    return sig;
}

main()
