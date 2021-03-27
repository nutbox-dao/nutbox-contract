const NutboxERC20 = artifacts.require("NutboxERC20");
const StakingTemplate = artifacts.require("StakingTemplate");

module.exports = function(deployer) {
  deployer.deploy(NutboxERC20, "Wonut", "WNUT", 18);
  deployer.deploy(StakingTemplate);
};
