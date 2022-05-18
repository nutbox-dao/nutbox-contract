
const DappsStaking = artifacts.require("DappsStaking");
const { padLeft, toHex, toWei, fromWei, toBN } = web3.utils;

//DeCus address
const dappAddress = "0x1CeE94a11eAf390B67Aa346E9Dda3019DfaD4f6A";


module.exports = async (callback) => {
    let instance = await DappsStaking.at("0x0000000000000000000000000000000000005001");
    //read_contract_stake
    let total = await instance.read_contract_stake(dappAddress);
    console.log("Total stake: %s", fromWei(total, "ether"));

    //stake
    await instance.bond_and_stake(dappAddress, "5000000000000000000");
    // FreeBalance 0, StakeBalance 1
    // await instance.set_reward_destination(0);


    //read_contract_stake
    total = await instance.read_contract_stake(dappAddress);
    console.log("Total stake2: %s", fromWei(total, "ether"));
    callback()
};