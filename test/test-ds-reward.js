const dotApi = require("@polkadot/api");
const DappsStaking = artifacts.require("DappsStaking");
const { padLeft, toHex, toWei, fromWei, toBN } = web3.utils;

//DeCus address
const dappAddress = "0x1CeE94a11eAf390B67Aa346E9Dda3019DfaD4f6A";

module.exports = async (callback) => {
    const accounts = await web3.eth.getAccounts()
    console.log("accounts: %s", accounts)
    let instance = await DappsStaking.at("0x0000000000000000000000000000000000005001");
    let era = await instance.read_current_era();
    console.log("current era: %s", era.toString())

    const wsProvider = new dotApi.WsProvider('wss://rpc.shibuya.astar.network');
    const api = await dotApi.ApiPromise.create({ provider: wsProvider });

    // Developer Percentage (shibuya)
    const developerPercentage = 15;
    let precision = toBN(toWei("1", "ether"))
    console.log(`Developer Percentage: %s`, developerPercentage);
    // let stakerPercentage = 100.0 / (100 - developerPercentage);
    // stakerPercentage = Math.floor(stakerPercentage * 10000) / 10000;
    // stakerPercentage = stakerPercentage * 100;
    let stakerPercentage = (100 - developerPercentage) / 2;

    // for (let i = 0; i < 10; i++) {
    //     era--;
    //     const [era_staked, era_reward, erainfo, eraStake] = await Promise.all([
    //         instance.read_era_staked(era),
    //         instance.read_era_reward(era),
    //         api.query.dappsStaking.generalEraInfo(era), 
    //         api.query.dappsStaking.contractEraStake({ Evm: dappAddress},era)
    //     ]);
    //     console.log("==============================================");
    //     console.log("ERA: %s", era);
    //     console.log("Total stake: %s", fromWei(era_staked, "ether"));
    //     console.log("Total reward: %s", fromWei(era_reward, "ether"));
    //     let reward = toBN(erainfo.unwrap().rewards.stakers.toString());
    //     // let mPrice = era_reward.mul(precision).div(era_staked);
    //     let mPrice = reward.mul(precision).div(era_staked);
    //     // mPrice = mPrice.muln(stakerPercentage).divn(100);
    //     console.log("Reward: %s", fromWei(mPrice, "ether"))
    //     let amount = await instance.read_staked_amount_on_contract(dappAddress, accounts[0])
    //     console.log("Account reward: %s", fromWei(mPrice.mul(amount).div(precision), "ether"))
    // }
    let calcEra = era - 1;
    console.log("calcEra: ", calcEra);
    
    let contractEraStakeMap = new Map();
    const eraInfoMap = new Map();
    let contractEraStakeEntries = await api.query.dappsStaking.contractEraStake.entries(
        { Evm: dappAddress }
    );
    contractEraStakeEntries.forEach(([key, points]) => {
        // console.log('[key, points] = ', key, points);
        const eraKey = parseInt(key.args.map((k) => k.toString())[1]);
        // console.log('eraKey', eraKey);
        contractEraStakeMap.set(eraKey, points.toJSON());
    });

    let unclaimed = 0;
    contractEraStakeMap.forEach((contractStakeInfo) => {
        // console.log('contractStakeInfo = ', contractStakeInfo);
        if (contractStakeInfo.contractRewardClaimed === false) unclaimed++;
    });
    console.log('unclaimed eras: ', unclaimed);

    let contractStakeInfo = contractEraStakeMap.get(calcEra);
    console.log(contractStakeInfo)
    console.log("Era dapp staked: ", fromWei(toBN(contractStakeInfo.total.toString()), "ether"));
    const eraInfoEntires = await api.query.dappsStaking.generalEraInfo.entries();
    eraInfoEntires.forEach(([key, eraInfo]) => {
        const eraKey = parseInt(key.args.map((k) => k.toString())[0]);
        // console.log('eraInfo', eraInfo.toJSON());
        eraInfoMap.set(eraKey, eraInfo.toJSON());
    });
    let eraInfo = eraInfoMap.get(calcEra);
    // console.log(eraInfo);
    console.log("Total staked: ", fromWei(toBN(eraInfo.staked.toString()),"ether"));
    console.log("Total dapp reward: ", eraInfo.rewards.dapps / eraInfo.staked);
    let R = eraInfo.rewards.dapps / contractStakeInfo.total;
    console.log("R: ", R);

    let contractStakeInfo_total = toBN(contractStakeInfo.total.toString());
    let eraInfo_staked = toBN(eraInfo.staked.toString());
    let eraInfo_rewards_stakers = toBN(eraInfo.rewards.stakers.toString());

    const contract_stake_portion = contractStakeInfo_total.mul(precision).div(eraInfo_staked);
    console.log('contract_stake_portion', fromWei(contract_stake_portion,"ether"));
    let stakers_joint_reward = eraInfo_rewards_stakers.mul(contract_stake_portion).div(precision);//dapps
    console.log("stakers_joint_reward: ", fromWei(stakers_joint_reward, "ether"));
    let staked = await instance.read_staked_amount_on_contract(dappAddress, accounts[0])
    console.log("staked: ",fromWei(staked,"ether"));
    let staker_reward = staked.mul(stakers_joint_reward).div(contractStakeInfo_total);
    // let staker_reward = staked.mul(precision).div(toBN(contractStakeInfo.total.toString())).mul(toBN(stakers_joint_reward)).div(precision);
    console.log("staker_reward: ", fromWei(staker_reward,"ether"));

    // let accStake = await instance.read_staked_amount_on_contract(dappAddress, accounts[0]);
    // let accReward = accStake.muln(contract_stake_portion);
    // console.log("accReward: ", fromWei(accReward, "ether"));

    callback()
};