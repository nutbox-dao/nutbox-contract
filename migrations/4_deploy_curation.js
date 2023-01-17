const Utils = artifacts.require("Utils");
const Curation = artifacts.require("Curation");


module.exports = async function (deployer, network, accounts) {
    let addr = accounts[0];
    if (network != "development") {
        addr = "0x31ea10e78F9F1e61861DE6bA10ad090904abC1d6";
    }
    console.log("prarms: ", addr);
    await deployer.deploy(Curation, addr);
};