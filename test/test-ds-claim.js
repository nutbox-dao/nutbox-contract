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
    let staked = await instance.read_staked_amount_on_contract(dappAddress, accounts[0])
    console.log("staked: %s", fromWei(staked, "ether"))
    let balance = await web3.eth.getBalance(accounts[0])
    console.log("balance: %s", fromWei(balance, "ether"))
    
    // for (let i = 0; i < 256; i++) {
        console.log("------------------------------------");
        await instance.claim_staker(dappAddress)
        balance = await web3.eth.getBalance(accounts[0])
        console.log("balance: %s", fromWei(balance, "ether"))
        let staked2 = await instance.read_staked_amount_on_contract(dappAddress, accounts[0])
        console.log("staked: %s", fromWei(staked2, "ether"))
        console.log("Reward: %s", fromWei(staked2.sub(staked), "ether"));
    // }

    callback()
};