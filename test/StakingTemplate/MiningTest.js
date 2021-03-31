const StakingTemplate = artifacts.require("StakingTemplate.sol")
const NutboxERC20Staking = artifacts.require("NutboxERC20.sol")
const NutboxERC20Reward = artifacts.require("NutboxERC20.sol")

const TruffleAssert = require('truffle-assertions')
const { assert } = require('chai')
const { time } = require('@openzeppelin/test-helpers')

contract("Staking mining test1", async accounts => {
    before(async () => {
        this.stakingFeast = await StakingTemplate.deployed()
        this.stakingToken = await NutboxERC20Staking.deployed("tDOT", "TDOT", 12)
        // account[0] would be the admin
        this.rewardToken = await NutboxERC20Reward.deployed("Donut", "DNUT", 18)
        await this.rewardToken.transferOwnership(this.stakingFeast.address, { from: accounts[0] })    })

    it("Should revert if no pool exist when deposit/withdraw", async () => {
        
        await this.stakingFeast.initialize(
            accounts[0],
            this.rewardToken.address,
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
            {
                from: accounts[0]
            }
        )

        await TruffleAssert.reverts(
            this.stakingFeast.deposit(0, "test", 100, {from: accounts[3]}),
            "Pool does not exist"
        )

        await TruffleAssert.reverts(
            this.stakingFeast.withdraw(0, "test", 100, {from: accounts[3]}),
            "Pool does not exist"
        )
    })
})

contract("Staking mining test2", async accounts => {
    before(async () => {
        this.stakingFeast = await StakingTemplate.deployed()

        this.stakingToken = await NutboxERC20Staking.deployed("tDOT", "TDOT", 12)
        await this.stakingToken.mint(accounts[1], 10000, {from: accounts[0]})
        await this.stakingToken.approve(this.stakingFeast.address, 10000, {from: accounts[1]});
        await this.stakingToken.mint(accounts[2], 10000, {from: accounts[0]})
        await this.stakingToken.approve(this.stakingFeast.address, 10000, {from: accounts[2]});

        // account[0] would be the admin
        this.rewardToken = await NutboxERC20Reward.deployed("Donut", "DNUT", 18)
        await this.rewardToken.transferOwnership(this.stakingFeast.address)

        // FIXME: why balance of account1 and account2 of rewardToken is 10000, should be 0
        console.log('------- before mining -------')
        console.log('balance of account1: ', (await this.rewardToken.balanceOf(accounts[1])).valueOf())
        console.log('balance of account2: ', (await this.rewardToken.balanceOf(accounts[2])).valueOf())
        console.log('--------------------------------')
    })

    it("Should mint properly of single pool", async () => {
        await this.stakingFeast.initialize(
            accounts[0],
            this.rewardToken.address,
            [
                {
                    "hasPassed": false,
                    "amount": 300,
                    "startHeight": 99,
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
                    "stopHeight": 4000000000000
                }
            ],
            [],
            {
                from: accounts[0]
            }
        )

        await this.stakingFeast.addPool(
            this.stakingToken.address,
            [100]
        )
        
        await time.advanceBlockTo('99')
        
        // account1 deposit 100 TDOT at block 100, who's reward computing start at block 101
        await this.stakingFeast.deposit(0, "account1", 100, {from: accounts[1]})
        await time.advanceBlockTo('199')
        
        // account2 deposit 100 TDOT at block 200, who's reward computing start at 201
        await this.stakingFeast.deposit(0, "account2", 100, {from: accounts[2]})
        await time.advanceBlockTo('250')

        // check staked amount
        assert.equal((await this.stakingFeast.getUserStakedAmount(0, {from: accounts[1]})).valueOf(), '100')
        assert.equal((await this.stakingFeast.getUserStakedAmount(0, {from: accounts[2]})).valueOf(), '100')
        assert.equal((await this.stakingFeast.getPoolTotalStakedAmount(0)).valueOf(), '200')

        // check distribution era
        let era = await this.stakingFeast.getCurrentDistributionEra()
        assert.equal(era.startHeight, 201)
        assert.equal(era.stopHeight, 300)
        assert.equal(era.hasPassed, false)

        // rewards of account1 = [101, 200]*300 + [201, 250]*200/2
        assert.equal((await this.stakingFeast.getPoolPendingRewards(0, {from: accounts[1]})).valueOf(), '35000')
        assert.equal((await this.stakingFeast.getTotalPendingRewards({from: accounts[1]})).valueOf(), '35000')

        // rewards of account2 = [201, 250]*200/2
        assert.equal((await this.stakingFeast.getPoolPendingRewards(0, {from: accounts[2]})).valueOf(), '5000')
        assert.equal((await this.stakingFeast.getTotalPendingRewards({from: accounts[2]})).valueOf(), '5000')

        console.log('------- before withdraw -------')
        console.log('balance of account1: ', (await this.rewardToken.balanceOf(accounts[1])).valueOf())
        console.log('balance of account2: ', (await this.rewardToken.balanceOf(accounts[2])).valueOf())
        console.log('--------------------------------')
        // block: 251
        await this.stakingFeast.withdrawRewards({from: accounts[1]})
        let rewards1 = await this.rewardToken.balanceOf.call(accounts[1])
        console.log('balance of account1: ', rewards1.toString())
        assert.equal((await this.rewardToken.balanceOf.call(accounts[1])).valueOf(), '35100')

        // block: 252
        await this.stakingFeast.withdrawRewards({from: accounts[2]})
        let rewards2 = await this.rewardToken.balanceOf.call(accounts[2])
        console.log('balance of account2: ', rewards2.toString())
        let totalSupply = await this.rewardToken.totalSupply.call()
        console.log('total supply: ', totalSupply.toString())
        assert.equal((await this.rewardToken.balanceOf.call(accounts[2])).valueOf(), '5200')

        // total supply of reward token should equal rewards((withdraw reward of account1: 35100) + (pending rewards of account1: 100), account2: 5200)
        assert.equal((await this.rewardToken.totalSupply()).valueOf(), '40400')
    })
})
