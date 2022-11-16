require('dotenv').config();
const ethers = require('ethers');
const { getEnv, waitForTx, sleep, advanceTime } = require('../scripts/utils');

const erc20Json = require('../build/contracts/ERC20PresetMinterPauser.json')
const PopupJson = require('../build/contracts/Popup.json');


const popupAddress = "0x62f0468B59Ff10D66FB21c7A6df8dBC3F73c3739";
const erc20Address = "0x110fC7b51d43241Fa7c5F587b8E620724f376Bc7";

const curationId = "208975624545445";
const popupTweetId = "149465164894515";
const winnerCount = 100;

const bonus = ethers.utils.parseEther("100"); //100 TEST
const fee = ethers.utils.parseEther("0.01"); //0.01 ETH

var seed = "";

function randomEthAddress() {
    const key = ethers.utils.randomBytes(32);
    const wallet = new ethers.Wallet(key);
    return wallet.address;
}

function generateRewards() {
    let rewards = [];
    let per = bonus.div(winnerCount);
    // console.log(ethers.utils.formatEther(per));
    for (let i = 0; i < winnerCount; i++) {
        const user = randomEthAddress();
        const twitterId = `10010${i}`;
        const index = i + 1;
        rewards.push({ user, twitterId, index, amount: per });
    }
    return rewards;
}


async function createPopup(popup, _curationId, _popupTweetId, _endTime, _winnerCount, _token, _bonus) {
    console.log("createPopup: ", _curationId, _popupTweetId, _endTime, _winnerCount, _token, _bonus);
    const tx = await popup.createPopup(_curationId, _popupTweetId, _endTime, _winnerCount, _token, _bonus, { value: fee });
    await waitForTx(popup.provider, tx.hash);
}

async function main() {
    let env = await getEnv();
    const Popup = new ethers.Contract(popupAddress, PopupJson.abi, env.wallet);
    const Erc20 = new ethers.Contract(erc20Address, erc20Json.abi, env.wallet);

    console.log("approve to %s...", Popup.address);
    let tx = await Erc20.approve(Popup.address, ethers.constants.MaxUint256);
    await waitForTx(env.provider, tx.hash);

    console.log("transfer to %s...", env.wallet.address);
    tx = await Erc20.mint(env.wallet.address, bonus);
    await waitForTx(env.provider, tx.hash);

    // create Pop-up
    await createPopup(Popup, curationId, popupTweetId, parseInt(new Date().getTime() / 1000 + 5), winnerCount, Erc20.address, bonus);

    let result = await Popup.getPopup(popupTweetId);
    console.log("getPopup: ", result, ethers.utils.formatEther(result.bonus));

    result = await Popup.getPopupByCuration(curationId);
    console.log("getPopupByCuration: ", result);

    await advanceTime(env, 6);

    // get gas balance
    let balance = await env.wallet.getBalance();
    console.log("balance: ", ethers.utils.formatEther(balance));

    // commit reward
    seed = ethers.utils.namehash(popupTweetId);
    console.log("seed: ", seed);
    let rewards = generateRewards();
    result = await Popup.commitReward(seed, popupTweetId, rewards);
    await waitForTx(env.provider, result.hash);
    result = await Popup.getPopup(popupTweetId);
    console.log("getPopup: ", result);

    // distribute
    result = await Popup.distribute(popupTweetId);
    await waitForTx(env.provider, result.hash);
    result = await Popup.getPopupByCuration(curationId);
    console.log("getPopupByCuration: ", result,"\r\n\tresult[0]: ", result[0].rewards[0]);

    // get gas balance
    let balance2 = await env.wallet.getBalance();
    console.log("balance: ", ethers.utils.formatEther(balance2), ethers.utils.formatEther(balance.sub(balance2)));
}

async function main2(){
    let env = await getEnv();
    const Popup = new ethers.Contract(popupAddress, PopupJson.abi, env.wallet);
    const Erc20 = new ethers.Contract(erc20Address, erc20Json.abi, env.wallet);

    console.log("approve to %s...", Popup.address);
    let tx = await Erc20.approve(Popup.address, ethers.constants.MaxUint256);
    await waitForTx(env.provider, tx.hash);

    console.log("transfer to %s...", env.wallet.address);
    tx = await Erc20.mint(env.wallet.address, bonus);
    await waitForTx(env.provider, tx.hash);

}

main2()
    .catch(console.error)
    .finally(() => process.exit());