const Curation = artifacts.require("Curation");
const ERC20PresetMinterPauser = artifacts.require("ERC20PresetMinterPauser");

module.exports = async function (deployer, network, accounts) {
    let addr = accounts[0];
    if (network != "development") {
        addr = "0x31ea10e78F9F1e61861DE6bA10ad090904abC1d6";
    } else {
        try {
            await ERC20PresetMinterPauser.at(ERC20PresetMinterPauser.address);
        } catch (e) {
            await deployer.deploy(ERC20PresetMinterPauser, "Test USDT", "USDT");
        }
    }
    console.log("prarms: ", addr);
    await deployer.deploy(Curation, deployer.network_id, addr);
};