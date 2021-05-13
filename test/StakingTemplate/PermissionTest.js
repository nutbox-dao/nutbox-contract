const StakingTemplate = artifacts.require("StakingTemplate.sol")
const NutboxERC20 = artifacts.require("NutboxERC20.sol");
const TruffleAssert = require('truffle-assertions');

contract("Permission test", async accounts => {
    before(async () => {
        // accounts balance: 1000 * 10 ** 18
    })

    it("Should revert if not factory call initialize()", async () => {
        let stakingFeast = await StakingTemplate.deployed()
        let rewardToken = await NutboxERC20.deployed("Donut", "DNUT", 18)
        // account[0] would be the factory address
        await TruffleAssert.reverts(stakingFeast.initialize(
            accounts[0],
            rewardToken.address,
            [],
            {
                from: accounts[1]
            }
        ), "Only Nutbox factory contract can create staking feast")
      })

      it("Should revert if not admin call addPool()", async () => {
        let stakingFeast = await StakingTemplate.deployed()
        // account[0] would be the admin
        let rewardToken = await NutboxERC20.deployed("Donut", "DNUT", 18)
        let stakingToken = await NutboxERC20.deployed("tDot", "TDOT", 12)
        await stakingFeast.initialize(
            accounts[0],
            rewardToken.address,
            []
        )

        await TruffleAssert.reverts(stakingFeast.addPool(
            stakingToken.address,
            [],
            {
                from: accounts[1]
            }
        ), "Account is not the admin")
      })

      it("Should revert if not admin call setPoolRatios()", async () => {
        let stakingFeast = await StakingTemplate.deployed()
        // account[0] would be the admin
        let rewardToken = await NutboxERC20.deployed("Donut", "DNUT", 18)
        await stakingFeast.initialize(
            accounts[0],
            rewardToken.address,
            []
        )

        await TruffleAssert.reverts(stakingFeast.setPoolRatios(
            [],
            {
                from: accounts[1]
            }
        ), "Account is not the admin")
      })
})
