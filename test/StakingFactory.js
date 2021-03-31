const StakingFactory = artifacts.require("StakingFactory.sol")
const StakingTemplate = artifacts.require("StakingTemplate.sol")
const NutboxERC20 = artifacts.require("NutboxERC20.sol")
const TruffleAssert = require('truffle-assertions')

contract("Staking mining test1", async accounts => {
    before(async () => {

    })

    it("Should revert if sender not the owner of reward token", async () => {
        let rewardToken = await NutboxERC20.deployed("Donut", "DNUT", 18)
        let factory = await StakingFactory.deployed(accounts[0])

        await TruffleAssert.reverts(
            factory.createStakingFeast(
                rewardToken.address,
                [
                    {
                        "hasPassed": false,
                        "amount": 300,
                        "startHeight": 101,
                        "stopHeight": 200
                    },
                    {
                        "hasPassed": false,
                        "amount": 200,
                        "startHeight": 201,
                        "stopHeight": 300
                    },
                    {
                        "hasPassed": false,
                        "amount": 100,
                        "startHeight": 301,
                        "stopHeight": 400
                    }
                ],
                [],
                {from: accounts[1]}
            ),
            "Deployer is not the owner of reward token"
        )
    })

    it("Should revert if distribution era list is empty", async () => {
        let rewardToken = await NutboxERC20.deployed("Donut", "DNUT", 18)
        let factory = await StakingFactory.deployed(accounts[0])

        await TruffleAssert.reverts(
            factory.createStakingFeast(
                rewardToken.address,
                [],
                [],
                {from: accounts[0]}
            ),
            "Should give at least one distribution"
        )
    })

    it("Should create staking feast properly", async () => {
        let rewardToken = await NutboxERC20.deployed("Donut", "DNUT", 18)
        let factory = await StakingFactory.deployed(accounts[0])

        console.log('accounts[0]', accounts[0])
        console.log('rewardToken: ', rewardToken.address)

        let result = await factory.createStakingFeast(
            rewardToken.address,
            [
                {
                    "hasPassed": false,
                    "amount": 300,
                    "startHeight": 101,
                    "stopHeight": 200
                },
                {
                    "hasPassed": false,
                    "amount": 200,
                    "startHeight": 201,
                    "stopHeight": 300
                },
                {
                    "hasPassed": false,
                    "amount": 100,
                    "startHeight": 301,
                    "stopHeight": 400
                }
            ],
            [],
            {from: accounts[0]}
        )

        console.log(result)

        TruffleAssert.eventEmitted(result, 'StakingFeastCreated', async (ev) => {
            console.log('ev: ', ev)
            console.log('staking feast address: ', ev[1])
            let stakingFeast = await StakingTemplate.at(ev[1])
            return (await stakingFeast.getAdmin()) == accounts[0] && (await rewardToken.owner()) == ev[1]
        })
    })
})
