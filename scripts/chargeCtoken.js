require('dotenv').config();
const ethers = require('ethers');
const { waitForTx } = require('./utils.js');
const StakingTemplateJSON = require('../build/contracts/StakingTemplate.json');

async function main() {
    let env = {};
    env.url = process.env.ENDPOINT || 'http://localhost:8545';
    env.privateKey = process.env.KEY;
    env.provider = new ethers.providers.JsonRpcProvider(env.url);
    env.wallet = new ethers.Wallet(env.privateKey, env.provider);
    env.gasLimit = ethers.utils.hexlify(Number(process.env.GASLIMIT));
    env.gasPrice = ethers.utils.hexlify(Number(process.env.GASPRICE));

    // hardcode
    env.bridgeFee = 0;
    env.bridgeExpiry = 10;
    env.feeAddr = env.wallet.address;



    const StakingTemplate = new ethers.Contract('', StakingTemplateJSON.abi, env.wallet);
    const tx = await StakingTemplate.adminDepositReward(
        ethers.utils.parseUnits("1000.0", 18)
    );
    await waitForTx(env.provider, tx.hash);
}

main()
  .catch(console.error)
  .finally(() => process.exit()); 