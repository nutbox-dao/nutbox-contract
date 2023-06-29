require('dotenv').config();
const ethers = require('ethers');
const { getEnv, deployContract, waitForTx, u8arryToHex, sleep } = require('./utils');
const { ArgumentParser } = require('argparse');

const CommunityCuration = require('../build/contracts/CommunityCuration.json');
const ERC20PresetMinterPauser = require('../build/contracts/ERC20PresetMinterPauser.json');
const AutoCuration = require("../build/contracts/AutoCuration.json");
const Point = require('../build/contracts/Point.json');

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

async function transfer(env) {
    if (!args.cid) return;
    let cCommunityCuration = new ethers.Contract(CommunityCuration.networks[env.chainId].address, CommunityCuration.abi, env.wallet);
    let info = await cCommunityCuration.getCommunityInfo(args.cid);
    let to = args.to === "STORE" ? info.storageAddr : args.to;
    if (to) {
        let amount = ethers.utils.parseUnits(args.amount, 18);
        let cPoint = new ethers.Contract(info.prizeToken, Point.abi, env.wallet);
        let tx = await cPoint.transfer(to, amount);
        await waitForTx(env.provider, tx.hash);
    }
}

async function main() {
    let env = await getEnv(false);
    if (args.command == "point") {
        let address = args.address;
        if (args.name && args.symbol) {
            let inits = ethers.utils.parseUnits(args.initsupply, 18);
            let owner = args.owner == "CONFIG" ? env.wallet.address : args.owner;
            address = await deployContract(env, Point, [args.name, args.symbol, inits, owner], [], true);
        }
        if (args.address && args.whitelist) {
            let cPoint = new ethers.Contract(address, Point.abi, env.wallet);
            let tx = await cPoint.setWhiteList(args.whitelist);
            await waitForTx(env.provider, tx.hash);
            let wAdd = await cPoint.whiteList(args.whitelist);
            console.log(`Address[${args.whitelist}]: ${wAdd}`);
        }
        return;
    }
    if (args.command === "transfer") {
        await transfer(env);
        return;
    }
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
    description: 'Deploy the community version curation contract. Need to add environment variables in .env: MAIN_KEY, MAIN_RPC',
    add_help: true
});

parser.add_argument('-I', '--curationId', { help: 'generate curation Id', action: 'store_true' });

const subparsers = parser.add_subparsers({ help: 'sub-command help' })
const parser_point = subparsers.add_parser('point', { help: 'deploy Point contract' });
parser_point.set_defaults({ command: "point" });

const group_deploy = parser_point.add_argument_group({ title: "deploy" });
group_deploy.add_argument('-N', '--name', { help: 'point name' });
group_deploy.add_argument('-S', '--symbol', { help: 'point symbol' });
group_deploy.add_argument('-I', '--initsupply', { help: 'point initial supply', default: "1000000000" });
group_deploy.add_argument('-O', '--owner', { help: 'point owner', default: "CONFIG" });

const group_set = parser_point.add_argument_group({ title: "set" });
group_set.add_argument('-A', '--address', { help: 'Point contract address' });
group_set.add_argument('-W', '--whitelist', { help: 'sender whitelist' });

const parser_show = subparsers.add_parser('show', { help: 'show community info', prog: "show" });
parser_show.set_defaults({ command: "show" });
parser_show.add_argument('cid', { help: 'community id' });

const parser_community = subparsers.add_parser('create', { help: 'Manage Community Contracts' });
parser_community.set_defaults({ command: "create" });
parser_community.add_argument('-C', '--cid', { help: 'community id' });
parser_community.add_argument('-S', '--saddr', { help: 'signature address', default: "0x4A584E33Dec216a124E36Aceb0B06Bc37642027B" });
parser_community.add_argument('-P', '--paddr', { help: 'prize token address' });
parser_community.add_argument('-D', '--deploy', { help: 'deploy new community factory', action: 'store_true' });

const parser_community_set = subparsers.add_parser('set', { help: 'Set community reward token address' });
parser_community_set.set_defaults({ command: "set" });
parser_community_set.add_argument('-C', '--cid', { help: 'community id' });
parser_community_set.add_argument('-P', '--paddr', { help: 'prize token address' });

const parser_community_transfer = subparsers.add_parser('transfer', { help: 'Transfer to store address' });
parser_community_transfer.set_defaults({ command: "transfer" });
parser_community_transfer.add_argument('-C', '--cid', { help: 'community id' });
parser_community_transfer.add_argument('-T', '--to', { help: 'target address', default: "STORE" });
parser_community_transfer.add_argument('-A', '--amount', { help: 'transfer amount', default: "3000000" });

const args = parser.parse_args();


if (args.curationId) {
    let id = randomCurationId();
    console.log("CurationId:", id);
    process.exit();
}

main()
    .catch(console.error)
    .finally(() => process.exit());

