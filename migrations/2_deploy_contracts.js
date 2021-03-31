const NutboxERC20 = artifacts.require("NutboxERC20");
const StakingTemplate = artifacts.require("StakingTemplate");
const StakingFactory = artifacts.require("StakingFactory");

module.exports = function(deployer) {
  deployer.deploy(NutboxERC20, "Wonut", "WNUT", 18);
  deployer.deploy(StakingTemplate);
  deployer.deploy(StakingFactory, "0xe887376a93bDa91ed66D814528D7aeEfe59990a5");
};
