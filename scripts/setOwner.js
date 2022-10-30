require('dotenv').config();
const { getEnv, waitForTx } = require('./utils');
const { ArgumentParser } = require('argparse');
const { ethers } = require('ethers');

const parser = new ArgumentParser({
    description: 'Argparse example'
});
parser.add_argument('-C', '--contract', { help: 'contract name' });
parser.add_argument('-A', '--address', { help: 'contract address' });
parser.add_argument('OWNER');

const args = parser.parse_args();

async function main() {
    if (ethers.utils.isAddress(args.OWNER)) {
        let env = await getEnv();
        const contractJson = require(`../build/contracts/${args.contract}.json`);
        let contract = new ethers.Contract(args.address, contractJson.abi, env.wallet);
        let tx = await contract.transferOwnership(args.OWNER, { gasPrice: env.gasPrice });
        await waitForTx(env.provider, tx.hash);
    } else {
        console.log("无效的新owner address.");
    }
}

main()
    .catch(console.error)
    .finally(() => process.exit());