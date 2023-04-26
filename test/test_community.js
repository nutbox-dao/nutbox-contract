require('dotenv').config();
const ethers = require('ethers');
const { getEnv, deployContract } = require('../scripts/utils');

const CommunityCuration = require('../build/contracts/CommunityCuration.json');
const ERC20PresetMinterPauser = require('../build/contracts/ERC20PresetMinterPauser.json');
const AutoCuration = require("../build/contracts/AutoCuration.json");

async function test_create(env) {
    let cid = 1;
    let signAddr = env.wallet.address;
    let prizeToken = "0x213D3300a88CcC95DaA8a6fD092a3572C525a1Ac";
    if (env.chainId == 1337) {
        prizeToken = ERC20PresetMinterPauser.networks[env.chainId].address;
    }
    let cCommunityCuration = new ethers.Contract(CommunityCuration.networks[env.chainId].address, CommunityCuration.abi, env.wallet);
    await cCommunityCuration.createCommunity(cid, signAddr, prizeToken);
    let info = await cCommunityCuration.getCommunityInfo(cid);
    console.log("info:", info);
    return { cCommunityCuration, info, cid };
}

async function test_inject_funds(env, cCommunityCuration, info) {
    let cERC20 = new ethers.Contract(info.prizeToken, ERC20PresetMinterPauser.abi, env.wallet);
    await cERC20.mint(info.storageAddr, ethers.utils.parseEther("10000"));
    info = await cCommunityCuration.getCommunityInfo(info.cid);
    console.log("info:", info);
}

async function test_claim(env, cCommunityCuration, info) {
    let cCuration = new ethers.Contract(info.communityAddr, AutoCuration.abi, env.wallet);
    let twitterId = 3419530221;
    let curationIds = [ethers.BigNumber.from(1).shl(48).or(ethers.BigNumber.from('0x4215233f3d1f')).toHexString()];
    let amount = ethers.utils.parseEther("1172.165639227039953926");
    let chainId = env.chainId == 1337 ? 1 : env.chainId;    //Ganache block.chainid bug
    let data = ethers.utils.solidityKeccak256(['uint256', 'uint256', 'address', 'uint256[]', 'uint256'], [twitterId, chainId, env.wallet.address, curationIds, amount]);
    data = ethers.utils.arrayify(data);
    let sign = await env.wallet.signMessage(data);
    console.log("sign: ", sign.length, sign);
    await cCuration.claimPrize(twitterId, env.wallet.address, curationIds, amount, sign);
    info = await cCommunityCuration.getCommunityInfo(info.cid);
    console.log("info:", info);
}

async function test_upgrade(env, cCommunityCuration, info) {
    // deploy new AutoCuration
    let newAutoCurationAddr = await deployContract(env, AutoCuration);
    let newCuration = new ethers.Contract(newAutoCurationAddr, AutoCuration.abi, env.wallet);
    // init AutoCuration
    await newCuration.init(info.cid, info.signAddr, info.prizeToken, info.creator, info.storageAddr);
    // show old autocuration address
    let oldA = await cCommunityCuration.communities(info.cid);
    console.log("old Address:", oldA);
    // replace storage contract
    await cCommunityCuration.upgrade(info.cid, newAutoCurationAddr);
    let newA = await cCommunityCuration.communities(info.cid);
    console.log("new Address:", newA);
    info = await cCommunityCuration.getCommunityInfo(info.cid);
    console.log("info:", info);
}

async function main() {
    let env = await getEnv(false);
    let { cCommunityCuration, info, cid } = await test_create(env);
    await test_inject_funds(env, cCommunityCuration, Object.assign({ cid }, info));
    await test_claim(env, cCommunityCuration, Object.assign({ cid }, info));
    await test_upgrade(env, cCommunityCuration, Object.assign({ cid }, info));

    // an "already claimed" error will occur if you claim again.
    info = await cCommunityCuration.getCommunityInfo(cid);
    await test_claim(env, cCommunityCuration, Object.assign({ cid }, info));
}


main()
    .catch(console.error)
    .finally(() => process.exit());