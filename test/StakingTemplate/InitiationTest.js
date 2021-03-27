const StakingTemplate = artifacts.require("StakingTemplate.sol")
const NutboxERC20 = artifacts.require("NutboxERC20.sol")
const TruffleAssert = require('truffle-assertions')

contract("Permission test", async accounts => {
    before(async () => {
        // accounts balance: 1000 * 10 ** 18
    })

    // struct Distribution {
    //     // if current block height > stopHeight, this distribution passed.
    //     bool hasPassed;
    //     // rewards per block of this distribution.
    //     uint256 amount;
    //     // when current block height > startHeight, distribution was enabled.
    //     uint256 startHeight;
    //     // when curent block height > stopHeight, distribution was disabled
    //     uint256 stopHeight;
    // }
    it("Should revert if too many distribution passed", async () => {
        let stakingFeast = await StakingTemplate.deployed()
        // account[0] would be the admin
        let rewardToken = await NutboxERC20.deployed("Donut", "DNUT", 18)
        await TruffleAssert.reverts(stakingFeast.initialize(
            accounts[0],
            rewardToken.address,
            [
                {
                    "hasPassed": false,
                    "amount": 60,
                    "startHeight": 101,
                    "stopHeight": 200
                },
                {
                    "hasPassed": false,
                    "amount": 50,
                    "startHeight": 201,
                    "stopHeight": 300
                },
                {
                    "hasPassed": false,
                    "amount": 40,
                    "startHeight": 301,
                    "stopHeight": 400
                },
                {
                    "hasPassed": false,
                    "amount": 30,
                    "startHeight": 401,
                    "stopHeight": 500
                },
                {
                    "hasPassed": false,
                    "amount": 20,
                    "startHeight": 501,
                    "stopHeight": 600
                },
                {
                    "hasPassed": false,
                    "amount": 10,
                    "startHeight": 601,
                    "stopHeight": 700
                },
                {
                    "hasPassed": false,
                    "amount": 5,
                    "startHeight": 701,
                    "stopHeight": 800
                }
            ],
            [],
            {
                from: accounts[0]
            }
        ), "Too many distribution policy")
    })

    it("Should revert if initial hasPassed is not false", async () => {
        let stakingFeast = await StakingTemplate.deployed()
        // account[0] would be the admin
        let rewardToken = await NutboxERC20.deployed("Donut", "DNUT", 18)
        await TruffleAssert.reverts(stakingFeast.initialize(
            accounts[0],
            rewardToken.address,
            [
                {
                    "hasPassed": true,
                    "amount": 60,
                    "startHeight": 101,
                    "stopHeight": 200
                }
            ],
            [],
            {
                from: accounts[0]
            }
        ), "Invlalid initial state of distribution")
    })

    it("Should revert if amount is zero", async () => {
        let stakingFeast = await StakingTemplate.deployed()
        // account[0] would be the admin
        let rewardToken = await NutboxERC20.deployed("Donut", "DNUT", 18)
        await TruffleAssert.reverts(stakingFeast.initialize(
            accounts[0],
            rewardToken.address,
            [
                {
                    "hasPassed": false,
                    "amount": 0,
                    "startHeight": 101,
                    "stopHeight": 200
                }
            ],
            [],
            {
                from: accounts[0]
            }
        ), "Invalid reward amount of distribution, consider giving a positive integer")
    })

    it("Should revert if start block is less than current block", async () => {
        let stakingFeast = await StakingTemplate.deployed()
        // account[0] would be the admin
        let rewardToken = await NutboxERC20.deployed("Donut", "DNUT", 18)
        await TruffleAssert.reverts(stakingFeast.initialize(
            accounts[0],
            rewardToken.address,
            [
                {
                    "hasPassed": false,
                    "amount": 10,
                    "startHeight": 1,
                    "stopHeight": 2
                }
            ],
            [],
            {
                from: accounts[0]
            }
        ), "Invalid start height of distribution")
    })

    it("Should revert if start block is greater than stop heght", async () => {
        let stakingFeast = await StakingTemplate.deployed()
        // account[0] would be the admin
        let rewardToken = await NutboxERC20.deployed("Donut", "DNUT", 18)
        await TruffleAssert.reverts(stakingFeast.initialize(
            accounts[0],
            rewardToken.address,
            [
                {
                    "hasPassed": false,
                    "amount": 10,
                    "startHeight": 1000,
                    "stopHeight": 2
                }
            ],
            [],
            {
                from: accounts[0]
            }
        ), "Invalid stop height of distribution")
    })

    it("Should revert if too many endowed accounts passed", async () => {
        let stakingFeast = await StakingTemplate.deployed()
        // account[0] would be the admin
        let rewardToken = await NutboxERC20.deployed("Donut", "DNUT", 18)
        await TruffleAssert.reverts(stakingFeast.initialize(
            accounts[0],
            rewardToken.address,
            [],
            accounts.concat(accounts[0]).map(account => {
                return {
                    "account": account,
                    "amount": 100
                }
            }),   // accounts.length == 10
            {
                from: accounts[0]
            }
        ), "Too many endowed accounts")
    })
})