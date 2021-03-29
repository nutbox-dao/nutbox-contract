const StakingTemplate = artifacts.require("StakingTemplate.sol")
const NutboxERC20 = artifacts.require("NutboxERC20.sol")
const TruffleAssert = require('truffle-assertions')
const { assert } = require('chai')
const { time } = require('@openzeppelin/test-helpers');

contract("Staking mining test1", async accounts => {
    before(async () => {
        // accounts balance: 1000 * 10 ** 18
    })

    it("Should revert if no pool exist when deposit/withdraw", async () => {
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
            stakingFeast.deposit(0, "test", accounts[3], 100),
            "Pool does not exist"
        )

        await TruffleAssert.reverts(
            stakingFeast.withdraw(0, "test", accounts[3], 100),
            "Pool does not exist"
        )
    })
})

contract("Staking mining test2", async accounts => {
    before(async () => {
        // Advance to the next block to correctly read time in the solidity "now" function interpreted by ganache
        // await time.advanceBlock()
    })

    it("Should mint properly of single pool", async () => {
        let stakingFeast = await StakingTemplate.deployed()
        let stakingToken = await NutboxERC20.deployed("tDOT", "TDOT", 12)
        // account[0] would be the admin
        let rewardToken = await NutboxERC20.deployed("Donut", "DNUT", 18)
        console.log('account0: ', accounts[0])
        console.log('staking: ', stakingFeast.address)
        console.log('owner of reward token: ', await rewardToken.owner())
        console.log('owner of staking token: ', await stakingToken.owner())
        await rewardToken.transferOwnership(stakingFeast.address)
        console.log('after transfer ownershiop, owner of reward token: ', await rewardToken.owner())

        await stakingFeast.initialize(
            accounts[0],
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
                    "stopHeight": 4000000000000
                }
            ],
            [],
            {
                from: accounts[0]
            }
        )

        stakingToken.mint(accounts[1], 10000, {from: accounts[0]})
        stakingToken.mint(accounts[2], 10000, {from: accounts[0]})
        
        stakingFeast.addPool(
            stakingToken.address,
            [100]
        )
        
        // FIXME: trown error: Uncaught RuntimeError: abort(Error: Returned error: VM Exception while processing transaction: revert Ownable: caller is not the owner -- Reason given: Ownable: caller is not the owner.). Build with -s ASSERTIONS=1 for more info.
        await time.advanceBlockTo('100')
        
        /*
        // account1 deposit 100 TDOT at block 101
        stakingFeast.deposit(0, "account1", accounts[1], 100, {from: accounts[1]})
        await time.advanceBlockTo('200')
        
        // account2 deposit 100 TDOT at block 201
        stakingFeast.deposit(0, "account2", accounts[2], 100, {from: accounts[2]})
        await time.advanceBlockTo('250')

        // check staked amount
        assert.equal((await stakingFeast.getUserStakedAmount(0, {from: accounts[1]})).valueOf(), '100')
        assert.equal((await stakingFeast.getUserStakedAmount(0, {from: accounts[2]})).valueOf(), '100')
        assert.equal((await stakingFeast.getPoolTotalStakedAmount(0)).valueOf(), '200')

        // check distribution era
        let era = await stakingFeast.getCurrentDistributionEra()
        assert.equal(era.startHeight, 201)
        assert.equal(era.stopHeight, 300)
        assert.equal(era.hasPassed, false)

        // rewards of account1 = [101, 200]*300 + [201, 250]*200/2
        assert.equal((await stakingFeast.getPoolPendingRewards(0, {from: accounts[1]})).valueOf(), '35000')
        assert.equal((await stakingFeast.getTotalPendingRewards(0, {from: accounts[1]})).valueOf(), '35000')

        // rewards of account2 = [201, 250]*200/2
        assert.equal((await stakingFeast.getPoolPendingRewards(0, {from: accounts[2]})).valueOf(), '5000')
        assert.equal((await stakingFeast.getTotalPendingRewards(0, {from: accounts[3]})).valueOf(), '5000')

        // total supply of reward token should equal rewards(account1, account2)
        assert.equal((await rewardToken.totalSupply()).valueOf(), '40000')
*/
    })
})
