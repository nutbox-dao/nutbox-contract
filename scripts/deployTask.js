require('dotenv').config();
const ethers = require('ethers');

const TaskJson = require('../build/contracts/Task.json');

async function deployTaskContract(env) {
    let factory = new ethers.ContractFactory(TaskJson.abi, TaskJson.bytecode, env.wallet);
    let contract = await factory.deploy({
        gasPrice: env.gasPrice
    });
    await contract.deployed();
    console.log("✓ Task contract deployed", contract.address);
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
    console.log(43, env.gasPrice.toString());

    const contract = await deployTaskContract(env)
    console.log(contract);

    // const CurationContract = new ethers.Contract(contract, TaskJson.abi, env.wallet)
    // const CurationContract = new ethers.Contract("0xBD9A7D0abAB3FfB42685CC0F73c2C2Ac1a59b74B", TaskJson.abi, env.wallet)

    // const tx = await CurationContract.transferOwnership("0xABD00D4e135de477265C326877bEfC80B28712F1");
    // console.log(tx.hash);
}

main()
  .catch(console.error)
  .finally(() => process.exit());