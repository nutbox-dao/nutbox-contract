const Curation = artifacts.require("Curation");
const ERC20PresetMinterPauser = artifacts.require("ERC20PresetMinterPauser");

module.exports = async function (deployer, network, accounts) {
    let addr = accounts[0];
    if (network != "development") {
        addr = "0x36F18e8B735592dE9A32A417e482e106eAa0C77A";
    } else {
        try {
            await ERC20PresetMinterPauser.at(ERC20PresetMinterPauser.address);
        } catch (e) {
            await deployer.deploy(ERC20PresetMinterPauser, "Test USDT", "USDT");
        }
    }
    console.log("prarms: ", deployer.network_id, addr);
    await deployer.deploy(Curation, deployer.network_id, addr);
};