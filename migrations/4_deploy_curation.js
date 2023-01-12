const Utils = artifacts.require("Utils");
const Curation = artifacts.require("Curation");


module.exports = async function (deployer, network, accounts) {
    try {
        await Utils.at(Utils.address);
    } catch (e) {
        await deployer.deploy(Utils);
    }

    await deployer.link(Utils, Curation);
    console.log("prarms: ", accounts[0]);
    await deployer.deploy(Curation, accounts[0]);
};