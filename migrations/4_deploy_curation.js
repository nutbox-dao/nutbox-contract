const Utils = artifacts.require("Utils");
const Curation = artifacts.require("Curation");


module.exports = async function (deployer, network, accounts) {

    console.log("prarms: ", accounts[0]);
    await deployer.deploy(Curation, accounts[0]);
};