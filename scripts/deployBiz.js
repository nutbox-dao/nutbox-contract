require('dotenv').config();
const ethers = require('ethers');

const PeanutBizJson = require('../build/contracts/PeanutBiz.json');
const MintableERC20Json = require('../build/contracts/MintableERC20.json');
const { waitForTx } = require('./utils');

let PeanutBizAddress = '0x9185BdceB084B217D72d8B5FE6a89a26644B4bFC' //  mainnet
const pnutAddress = '0x705931A83C9b22fB29985f28Aee3337Aa10EFE11' // 

async function deployBiz(env) {
    let factory = new ethers.ContractFactory(PeanutBizJson.abi, PeanutBizJson.bytecode, env.wallet);
    let contract = await factory.deploy(
        pnutAddress
    );
    await contract.deployed();
    console.log("✓ PeanutBiz contract deployed", contract.address);
    return contract.address;
}

async function test(env) {
    const pnut = new ethers.Contract(pnutAddress,MintableERC20Json.abi, env.wallet)
    let tx = await pnut.approve(PeanutBizAddress, ethers.constants.MaxUint256);
    await waitForTx(env.provider, tx.hash)

    const peanutBiz = new ethers.Contract(PeanutBizAddress, PeanutBizJson.abi, env.wallet);
    // add new payment
    tx = await peanutBiz.addNewPayment('terry3t', 'test', ethers.utils.parseUnits('1000', 18))
    await waitForTx(env.provider, tx.hash)

    let count = await peanutBiz.getTotalPaymentCount();
    console.log('Total count should be 1, and is:', count);
    
    try{
        tx = await peanutBiz.addNewPayment('terry3t', 'test', ethers.utils.parseUnits('1000', 18))
    }catch(e) {
        console.log('author is pending');
    }
    try{
        tx = await peanutBiz.addNewPayment('terry5t', 'test', ethers.utils.parseUnits('10', 18))
    }catch(e) {
        console.log('payment is less than threshold');
    }

    tx = await peanutBiz.addNewPayment('terry5t', 'test2', ethers.utils.parseUnits('200', 18))
    await waitForTx(env.provider, tx.hash)
    
    count = await peanutBiz.getTotalPaymentCount();
    console.log('Total count should be 2, and is:', count);

    let payment = await peanutBiz.getPaymentById(0);
    console.log('First payment', payment);

    tx = await peanutBiz.addNewPayment('terry6t', 'test3', ethers.utils.parseUnits('210', 18))
    await waitForTx(env.provider, tx.hash)
    
    count = await peanutBiz.getTotalPaymentCount();
    console.log('Total count should be 3, and is:', count);
    
    tx = await peanutBiz.closePayment(1, ethers.utils.parseUnits('800', 18))
    await waitForTx(env.provider, tx.hash)

    let ids = await peanutBiz.getPendingIds();
    console.log('Total ids should be [0,2], and is:', ids);

    let totalRevenue = await peanutBiz.totalRevenue();
    console.log('total revenue should be 200, and is:', totalRevenue.toString() / 1e18);

    try{
        tx = await peanutBiz.burnPnut(ethers.utils.parseUnits('10000',18))
    }catch(e) {
        console.log('Burn out of limit:');
    }

    tx = await peanutBiz.burnPnut(ethers.utils.parseUnits('200',18))
    console.log('Burn 200');
    
    try{
        tx = await peanutBiz.burnPnut(ethers.utils.parseUnits('1',18))
    }catch(e) {
        console.log('Burn out of limit:');
    }

    tx = await peanutBiz.cancelPayment(0, 'Out of date');
    await waitForTx(env.provider, tx.hash)

    payment = await peanutBiz.getPaymentById(0);
    console.log('First payment', payment);

    tx = await peanutBiz.addNewPayment('terry3t', 'test', ethers.utils.parseUnits('1000', 18))
    await waitForTx(env.provider, tx.hash)
    ids = await peanutBiz.getPendingIds();
    console.log('Total ids should be [2, 3], and is:', ids);


}

async function main() {
    let env = {};
    env.url = process.env.ENDPOINT || 'http://localhost:8545';
    env.privateKey = process.env.KEY;
    env.provider = new ethers.providers.JsonRpcProvider(env.url);
    console.log(`private: ${env.privateKey}, url: ${env.url}`);
    env.wallet = new ethers.Wallet(env.privateKey, env.provider);
    env.gasLimit = ethers.utils.hexlify(Number(process.env.GASLIMIT));
    env.gasPrice = await env.provider.getGasPrice();

    // PeanutBizAddress = await deployBiz(env)
    const biz = new ethers.Contract(PeanutBizAddress, PeanutBizJson.abi, env.wallet)
    biz.transferOwnership('0x28D4FB9933badCE9C3596cEA248d98De03012F8B');
    // await test(env)
}

main()