const StakingTemplate = artifacts.require("StakingTemplate.sol")
const NutboxERC20 = artifacts.require("NutboxERC20.sol")
const TruffleAssert = require('truffle-assertions')
const { assert } = require('chai')

contract("Staking Pool test", async accounts => {
    before(async () => {
        // accounts balance: 1000 * 10 ** 18
    })

    it("Should revert if ratio count not equal pool count", async () => {
        let stakingFeast = await StakingTemplate.deployed()
        let stakingToken = await NutboxERC20.deployed("tDOT", "TDOT", 12)
        // account[0] would be the admin
        let rewardToken = await NutboxERC20.deployed("Donut", "DNUT", 18)
        await rewardToken.transferOwnership(stakingFeast.address, { from: accounts[0] })
        
        await stakingFeast.initialize(
            accounts[0],
            rewardToken.address,
            [
                {
                    "amount": 300,
                    "startHeight": 101,
                    "stopHeight": 200
                },
                {
                    "amount": 200,
                    "startHeight": 201,
                    "stopHeight": 300
                },
                {
                    "amount": 100,
                    "startHeight": 301,
                    "stopHeight": 400
                }
            ],
            {
                from: accounts[0]
            }
        )

        await TruffleAssert.reverts(
            stakingFeast.addPool(
                stakingToken.address,
                [50, 50]
            ),
            "Wrong ratio count"
        )
    })

    it("Should revert if ratios summary is not equal 100", async () => {
        let stakingFeast = await StakingTemplate.deployed()
        let stakingToken = await NutboxERC20.deployed("tDOT", "TDOT", 12)
        // account[0] would be the admin
        let rewardToken = await NutboxERC20.deployed("Wonut", "WNUT", 18)

        // FIXME: truffle doen not clean context
        // await rewardToken.transferOwnership(stakingFeast.address, { from: accounts[0] })
        
        await stakingFeast.initialize(
            accounts[0],
            rewardToken.address,
            [
                {
                    "amount": 300,
                    "startHeight": 101,
                    "stopHeight": 200
                },
                {
                    "amount": 200,
                    "startHeight": 201,
                    "stopHeight": 300
                },
                {
                    "amount": 100,
                    "startHeight": 301,
                    "stopHeight": 400
                }
            ],
            {
                from: accounts[0]
            }
        )

        await TruffleAssert.reverts(
            stakingFeast.addPool(
                stakingToken.address,
                [50]
            ),
            "Ratio summary not equal to 100"
        )
    })

    it("Should set pool information properly", async () => {
        let stakingFeast = await StakingTemplate.deployed()
        let stakingToken1 = await NutboxERC20.deployed("tDOT", "TDOT", 12)
        let stakingToken2 = await NutboxERC20.deployed("tKSM", "TKSM", 12)

        // account[0] would be the admin
        let rewardToken = await NutboxERC20.deployed("Wonut", "WNUT", 18)

        // FIXME: truffle doen not clean context
        // await rewardToken.transferOwnership(stakingFeast.address, { from: accounts[0] })
        
        await stakingFeast.initialize(
            accounts[0],
            rewardToken.address,
            [
                {
                    "amount": 300,
                    "startHeight": 101,
                    "stopHeight": 200
                },
                {
                    "amount": 200,
                    "startHeight": 201,
                    "stopHeight": 300
                },
                {
                    "amount": 100,
                    "startHeight": 301,
                    "stopHeight": 400
                }
            ],
            {
                from: accounts[0]
            }
        )

        await stakingFeast.addPool(
            stakingToken1.address,
            [100]
        )
        assert.equal(await stakingFeast.getSinglePoolRatio(0).valueOf(), "100")

        await stakingFeast.addPool(
            stakingToken2.address,
            [40, 60]
        )
        let ratios = await stakingFeast.getPoolRatios()
        assert.equal(ratios.length, 10)
        assert.equal(ratios[0].valueOf(), "40")
        assert.equal(ratios[1].valueOf(), "60")
        assert.equal(ratios[2].valueOf(), "0")
        assert.equal(ratios[3].valueOf(), "0")
        assert.equal(ratios[4].valueOf(), "0")
        assert.equal(ratios[5].valueOf(), "0")
        assert.equal(ratios[6].valueOf(), "0")
        assert.equal(ratios[7].valueOf(), "0")
        assert.equal(ratios[8].valueOf(), "0")
        assert.equal(ratios[9].valueOf(), "0")

        await stakingFeast.setPoolRatios([20, 80])
        assert.equal(await stakingFeast.getSinglePoolRatio(0).valueOf(), "20")
        assert.equal(await stakingFeast.getSinglePoolRatio(1).valueOf(), "80")
    })
})
