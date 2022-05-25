const dotApi = require("@polkadot/api");
const DappsStaking = artifacts.require("DappsStaking");
const { padLeft, toHex, toWei, fromWei, toBN } = web3.utils;

//DeCus address
const dappAddress = "0x1CeE94a11eAf390B67Aa346E9Dda3019DfaD4f6A";

module.exports = async (callback) => {
    const accounts = await web3.eth.getAccounts()
    console.log("accounts: %s", accounts[0])
    let balance = await web3.eth.getBalance(accounts[0])
    console.log("balance: %s", fromWei(balance, "ether"))
    let instance = await DappsStaking.at("0x0000000000000000000000000000000000005001");
    let era = await instance.read_current_era();
    console.log("current era: %s", era.toString())
    //read chain
    const wsProvider = new dotApi.WsProvider('wss://rpc.shibuya.astar.network');
    // const wsProvider = new dotApi.WsProvider('wss://rpc.astar.network');
    const api = await dotApi.ApiPromise.create({ provider: wsProvider });
    const chain = await api.rpc.system.chain();
    console.log("Chain: %s", chain.valueOf());
    const getDeveloperPercentage = async () => {
        const result = await api.query.blockReward.rewardDistributionConfigStorage();
        // console.log("blockReward:\n", result.toHuman());
        let percentage = result.dappsPercent.toNumber() * 0.000000001;
        // console.log("percentage: %s", percentage);
        percentage = Math.floor(percentage * 10000) / 10000;
        return percentage;
    };
    //net params
    const [
        minimumStakingAmount,
        maxNumberOfStakersPerContract,
        maxUnlockingChunks,
        unbondingPeriod,
        developerRewardPercentage,
        blockPerEra,
        blockReward,
    ] = await Promise.all([
        api.consts.dappsStaking.minimumStakingAmount,
        api.consts.dappsStaking.maxNumberOfStakersPerContract,
        api.consts.dappsStaking.maxUnlockingChunks,
        api.consts.dappsStaking.unbondingPeriod,
        // api.consts.dappsStaking.developerRewardPercentage,
        getDeveloperPercentage(),
        api.consts.dappsStaking.blockPerEra,
        api.consts.blockReward.rewardAmount
    ]);
    // let drp = (developerRewardPercentage?.toHuman() || "0.0");
    // drp = Number(drp.toString().split(".")[0]);

    console.log(`stake info: 
            minimumStakingAmount: %s
            maxNumberOfStakersPerContract: %s
            maxUnlockingChunks: %s
            unbondingPeriod: %s
            developerRewardPercentage: %s
            blockPerEra: %s
            blockReward: %s
            blockPerEra: %s`,
        minimumStakingAmount,
        maxNumberOfStakersPerContract,
        maxUnlockingChunks,
        unbondingPeriod,
        // drp
        developerRewardPercentage,
        blockPerEra,
        fromWei(blockReward, "ether")
    );
    // stakerInfo
    // const stakerInfo = await api.query.dappsStaking.generalStakerInfo(
    //     { Evm: accounts[0] },//Not yet supported
    //     { Evm: dappAddress }
    // );
    // console.log(`stakerInfo:\n\t%s`, stakerInfo.toHuman());
    // staked info
    // Era info
    console.log("calcEra: ", era - 1)
    let erainfo = await api.query.dappsStaking.generalEraInfo(era - 1);
    // console.log("erainfo: ", erainfo.toHuman())
    erainfo = erainfo.unwrap()
    let rrr = toBN(erainfo.rewards.dapps.toString()).add(toBN(erainfo.rewards.stakers.toString()));
    console.log("RPC API reward: %s", fromWei(rrr, "ether"));
    console.log("==============================================");
    let [era_staked, era_reward, dapp_staked, account_staked] = await Promise.all([
        instance.read_era_staked(era - 1),
        instance.read_era_reward(era - 1),
        instance.read_contract_stake(dappAddress),
        instance.read_staked_amount_on_contract(dappAddress, accounts[0])
    ]);
    let precision = toBN(toWei("1", "ether"))
    let rewardRito = era_reward.mul(precision).div(era_staked);
    console.log("Total staked: %s", fromWei(era_staked, "ether"));
    console.log("Total reward: %s", fromWei(era_reward, "ether"));
    console.log("Reward rito: ", fromWei(rewardRito, "ether"));
    console.log("Dapps staked: %s", fromWei(dapp_staked, "ether"));
    console.log("Account staked: %s", fromWei(account_staked, "ether"));
    console.log("Account reward: ", fromWei(account_staked.mul(rewardRito).div(precision), "ether"))
    callback()
};