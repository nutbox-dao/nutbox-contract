// USAGE: 
//  ENDPOINT=http://localhost:8545 KEY=<private key> GASLIMIT=10000000 GASPRICE=50000000000 node deploy.js

require('dotenv').config();
const ethers = require('ethers');
const fs = require("fs");

const MultiCallJson = require('../build/contracts/Multicall.json')

async function deployMulticallContract(env) {
    let factory = new ethers.ContractFactory(MultiCallJson.abi, MultiCallJson.bytecode, env.wallet);
    let contract = await factory.deploy()
    await contract.deployed();
    env.MulticallContract = contract.address;
    console.log("✓ Multicall contract deployed");
}

async function main() {
    let env = {};
    env.url = process.env.TESTENDPOINT || 'http://localhost:8545';
    env.privateKey = process.env.TESTKEY;
    env.provider = new ethers.providers.JsonRpcProvider(env.url);
    env.wallet = new ethers.Wallet(env.privateKey, env.provider);
    env.gasLimit = ethers.utils.hexlify(Number(process.env.GASLIMIT));
    env.gasPrice = ethers.utils.hexlify(Number(process.env.GASPRICE));

    // hardcode
    env.bridgeFee = 0;
    env.bridgeExpiry = 10;
    env.feeAddr = env.wallet.address;

    let startBalance = await env.provider.getBalance(env.wallet.address)

    await deployMulticallContract(env)

    let deployCost = startBalance.sub((await env.provider.getBalance(env.wallet.address)))

    // dump to local file
    const output = {
        Multicall: env.MulticallContract ? env.MulticallContract : "Not Deployed",
    };
    
    const outfile = './scripts/multicall.json'
    const jsonStr = JSON.stringify(output, undefined, 2);
    fs.writeFileSync(outfile, jsonStr, { encoding: "utf-8" });

    console.log(`
    ================================================================
    Url:        ${env.url}
    Deployer:   ${env.wallet.address}
    Gas Limit:   ${ethers.BigNumber.from(env.gasLimit)}
    Gas Price:   ${ethers.BigNumber.from(env.gasPrice)}
    Deploy Cost: ${ethers.utils.formatEther(deployCost)}
    
    Options
    =======
    Bridge Fee:     ${env.bridgeFee}
    Bridge Expiry:  ${env.bridgeExpiry}
    Fee Addr:       ${env.feeAddr}
    
    Contract Addresses
    ================================================================
    MulticallContract:                        ${env.MulticallContract ? env.MulticallContract : "Not Deployed"}
    ================================================================
            `)
}

main()
  .catch(console.error)
  .finally(() => process.exit());