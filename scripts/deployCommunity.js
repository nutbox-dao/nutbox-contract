require('dotenv').config();
const ethers = require('ethers');
const { getEnv, deployContract, waitForTx, u8arryToHex } = require('./utils');
const { ArgumentParser } = require('argparse');

const CommunityCuration = require('../build/contracts/CommunityCuration.json');
const ERC20PresetMinterPauser = require('../build/contracts/ERC20PresetMinterPauser.json');
const AutoCuration = require("../build/contracts/AutoCuration.json");

function randomCurationId() {
    let id = ethers.utils.randomBytes(6)
    id = u8arryToHex(id);
    return id;
}

async function setPrize(env, cid, pToken) {
    let cCommunityCuration = new ethers.Contract(CommunityCuration.networks[env.chainId].address, CommunityCuration.abi, env.wallet);
    let info = await cCommunityCuration.getCommunityInfo(cid);
    console.log("info:", info);
    if ("communityAddr" in info) {
        let autoCuration = new ethers.Contract(info.communityAddr, AutoCuration.abi, env.wallet);
        if (pToken) {
            let tx = await autoCuration.setPrizeToken(pToken);
            await waitForTx(env.provider, tx.hash);
            info = await cCommunityCuration.getCommunityInfo(cid);
            console.log("result info:", info);
        }
    }
}

async function main() {
    let env = await getEnv(false);
    if (args.command === "set" && args.paddr && args.cid) {
        await setPrize(env, args.cid, args.paddr);
        return;
    }
    if (args.deploy)
        await deployContract(env, CommunityCuration);
    let prizeToken = args.paddr;
    if (env.chainId == 1337) {
        if (args.deploy) {
            await deployContract(env, ERC20PresetMinterPauser, ["Test USDT", "USDT"]);
            prizeToken = ERC20PresetMinterPauser.networks[env.chainId].address;
        }
    }
    if (args.cid) {
        let cCommunityCuration = new ethers.Contract(CommunityCuration.networks[env.chainId].address, CommunityCuration.abi, env.wallet);
        if (args.command === "create") {
            if (args.saddr && prizeToken) {
                // create community
                let tx = await cCommunityCuration.createCommunity(args.cid, args.saddr, prizeToken);
                await waitForTx(env.provider, tx.hash);
            }
        }
        let info = await cCommunityCuration.getCommunityInfo(args.cid);
        console.log("info:", info);
    }
}

const parser = new ArgumentParser({
    description: 'Deploy the community version curation contract'
});
parser.add_argument('command', { choices: ['show', 'set', "create"], help: 'the command to run' });
parser.add_argument('-C', '--cid', { help: 'community id' });
parser.add_argument('-S', '--saddr', { help: 'signature address' });
parser.add_argument('-P', '--paddr', { help: 'prize token address' });
parser.add_argument('-I', '--curationId', { help: 'Curation Id', action: 'store_true' });
parser.add_argument('-D', '--deploy', { help: 'deploy new community factory', action: 'store_true' });
const args = parser.parse_args();

if (args.curationId) {
    let id = randomCurationId();
    console.log("CurationId:", id);
    process.exit();
}



main()
    .catch(console.error)
    .finally(() => process.exit());

