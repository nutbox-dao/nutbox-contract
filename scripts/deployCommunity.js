require('dotenv').config();
const ethers = require('ethers');
const { getEnv, deployContract, waitForTx, u8arryToHex } = require('./utils');
const { ArgumentParser } = require('argparse');

const CommunityCuration = require('../build/contracts/CommunityCuration.json');
const ERC20PresetMinterPauser = require('../build/contracts/ERC20PresetMinterPauser.json');

function randomCurationId() {
    let id = ethers.utils.randomBytes(6)
    id = u8arryToHex(id);
    return id;
}

async function main() {
    let env = await getEnv(false);
    await deployContract(env, CommunityCuration);
    let prizeToken = args.paddr;
    if (env.chainId == 1337) {
        await deployContract(env, ERC20PresetMinterPauser, ["Test USDT", "USDT"]);
        prizeToken = ERC20PresetMinterPauser.networks[env.chainId].address;
    }
    if (args.cid && args.saddr && prizeToken) {
        // create community
        let cCommunityCuration = new ethers.Contract(CommunityCuration.networks[env.chainId].address, CommunityCuration.abi, env.wallet);
        let tx = await cCommunityCuration.createCommunity(args.cid, args.saddr, prizeToken);
        await waitForTx(env.provider, tx.hash);
        let info = await cCommunityCuration.getCommunityInfo(args.cid);
        console.log("info:", info);
    }
}

const parser = new ArgumentParser({
    description: 'Deploy the community version curation contract'
});
parser.add_argument('-C', '--cid', { help: 'community id' });
parser.add_argument('-S', '--saddr', { help: 'signature address' });
parser.add_argument('-P', '--paddr', { help: 'prize token address' });
parser.add_argument('-I', '--curationId', { help: 'Curation Id', action: 'store_true' });
const args = parser.parse_args();

if (args.curationId) {
    let id = randomCurationId();
    console.log("CurationId:", id);
    process.exit();
}

main()
    .catch(console.error)
    .finally(() => process.exit());