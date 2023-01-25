require('dotenv').config();
const ethers = require('ethers');
const { getEnv, getGasPrice } = require('./utils');
const { ArgumentParser } = require('argparse');
const Curation = require('../build/contracts/Curation.json');

var env;

async function redeem() {
    let address = args.address ?? Curation.networks[env.chainId].address;
    console.log("Curation contract: ", address);
    let cid = args.curation;
    let cCuration = new ethers.Contract(address, Curation.abi, env.wallet);
    if (args.show) {
        let info = await cCuration.taskInfo(`0x${cid}`);
        console.log("info: ", info);
        console.log("endTime: ", new Date(info.endTime.toNumber() * 1000));
        return;
    }

    if (cid) {
        let gasPrice = await getGasPrice(env);
        let tx = await cCuration.redeem(`0x${cid}`, { gasPrice });
        console.log("tx: ", tx.hash);
    } else {
        console.log("curation id is null");
    }
}


async function main() {
    env = await getEnv(false);
    await redeem();
}

const parser = new ArgumentParser({
    description: 'Argparse example'
});
parser.add_argument('-A', '--address', { help: 'contract address, e.g. 0x603d00d2e2c8ebf4fbd05b4ddd07366504c04cf2' });
parser.add_argument('-C', '--curation', { help: 'curation id, e.g. 31fab64a9270' });
parser.add_argument('-S', '--show', { help: 'show curation info', action: 'store_true' });
const args = parser.parse_args();

main()
    .catch(console.error)
    .finally(() => process.exit());