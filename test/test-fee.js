const { expect } = require("chai");
const { ethers, helpers } = require('hardhat');
const hre = require("hardhat");
const { mine, loadFixture, mineUpTo, time } = require("@nomicfoundation/hardhat-network-helpers");
const deployCommunity = require('./create-community')

describe('claim fee', function () {
    let contracts;
    let owner;
    let communityOwner;
    let alice;
    let bob;

    function parseAmount(amount) {
        return ethers.utils.parseEther(amount.toString())
    }
    beforeEach(async () => {
        contracts = await loadFixture(deployCommunity)
        await contracts.Committee.adminSetFee('USER', ethers.utils.parseEther('0.0001'));
        owner = contracts.owner;
        communityOwner = contracts.communityOwner;
        alice = contracts.alice;
        bob = contracts.bob;
    })

    describe('ERC20 pool deposit/withdraw/claim will cost fee', function () {
        let pool;

        beforeEach(async () => {
            const tx = await contracts.Community.connect(communityOwner).adminAddPool("stake mferc", [10000], contracts.ERC20StakingFactory.address, contracts.CToken.address);
            const receipt = await tx.wait();
            const event = receipt.events.find(e => e.event === 'AdminSetPoolRatio')
            pool = await ethers.getContractAt('ERC20Staking', event.args.pools[0]);
            await contracts.CToken.connect(communityOwner).approve(pool.address, parseAmount(100000));
            await mine(110);
        })

       it('will revert if deposit without fee', async () => {
            await expect(pool.connect(communityOwner).deposit(parseAmount(1)))
                .to.revertedWith('cost fee fail')

            await expect(pool.connect(communityOwner).deposit(parseAmount(1), {
                value: 100000
            }))
                .to.revertedWith('cost fee fail')
       })

       it('Can deposit if provide fee', async () => {
        await expect(pool.connect(communityOwner).deposit(parseAmount(1), {
            value: parseAmount(0.0001)
        })).to.changeEtherBalances([owner, communityOwner], [parseAmount(0.0001), parseAmount(-0.0001)])
       })

       it('will revert if withdraw without fee', async () => {
            await pool.connect(communityOwner).deposit(parseAmount(10), {
                value: parseAmount(0.0001)
            })

            await mine(10);

            await expect(pool.connect(communityOwner).withdraw(parseAmount(1), {
                value: 100000
            })).to.revertedWith('cost fee fail')
        })

        it('can withdraw with enouph fee', async () => {
            await pool.connect(communityOwner).deposit(parseAmount(10), {
                value: parseAmount(0.0001)
            })

            await mine(10);

            await expect(pool.connect(communityOwner).withdraw(parseAmount(1), {
                value: parseAmount(0.01)
            })).to.changeEtherBalances([owner, communityOwner], [parseAmount(0.01), parseAmount(-0.01)])
        })

        it('will revert when claim with insufficient fee', async () => {
            await pool.connect(communityOwner).deposit(parseAmount(10), {
                value: parseAmount(0.0001)
            })

            await mine(10);

            await expect(contracts.Community.connect(communityOwner).withdrawPoolsRewards([pool.address]))
                .to.revertedWith('cost fee fail')

            await expect(contracts.Community.connect(communityOwner).withdrawPoolsRewards([pool.address], {
                value: parseAmount(0.000099)
            })).to.revertedWith('cost fee fail')
        })

        it('Can claim reward with fee', async () => {
            await pool.connect(communityOwner).deposit(parseAmount(10), {
                value: parseAmount(0.0001)
            })

            await mine(10);

            await expect(contracts.Community.connect(communityOwner).withdrawPoolsRewards([pool.address], {
                value: parseAmount(0.0002)
            })).to.changeEtherBalances([owner, communityOwner], [parseAmount(0.0002), parseAmount(-0.0002)])
        })
    })

    describe('ETH pool deposit/withdraw/claim will cost fee', function () {
        let pool;

        beforeEach(async () => {
            const tx = await contracts.Community.connect(communityOwner).adminAddPool("stake eth", [10000], contracts.ETHStakingFactory.address, 0x00);
            const receipt = await tx.wait();
            const event = receipt.events.find(e => e.event === 'AdminSetPoolRatio')
            pool = await ethers.getContractAt('ETHStaking', event.args.pools[0]);
            await mine(110);
        })

        it('will revert if deposit without fee', async () => {
            await expect(pool.connect(communityOwner).deposit(parseAmount(1), {
                value: parseAmount(1)
            })).to.revertedWith('cost fee fail')
        })

        it('Can deposit if provide fee', async () => {
            await expect(pool.connect(communityOwner).deposit(parseAmount(1), {
            value: parseAmount(1.0001)
        })).to.changeEtherBalances([owner, communityOwner], [parseAmount(0.0001), parseAmount(-1.0001)])
        })

        it('will revert if withdraw without fee', async () => {
            await pool.connect(communityOwner).deposit(parseAmount(0.00001), {
                value: parseAmount(0.00011)
            })

            await mine(10);

            await expect(pool.connect(communityOwner).withdraw(parseAmount(0.00001)))
            .to.revertedWith('Insufficient fee')
        })

        it('can withdraw with enouph fee', async () => {
            await pool.connect(communityOwner).deposit(parseAmount(1), {
                value: parseAmount(1.0001)
            })

            await mine(10);

            await expect(pool.connect(communityOwner).withdraw(parseAmount(1)))
            .to.changeEtherBalances([owner, pool, communityOwner], 
                [parseAmount(0.0001), parseAmount(-1), parseAmount(0.9999)])
        })

        it('will revert when claim with insufficient fee', async () => {
            await pool.connect(communityOwner).deposit(parseAmount(1), {
                value: parseAmount(1.0001)
            })

            await mine(10);

            await expect(contracts.Community.connect(communityOwner).withdrawPoolsRewards([pool.address]))
                .to.revertedWith('cost fee fail')

            await expect(contracts.Community.connect(communityOwner).withdrawPoolsRewards([pool.address], {
                value: parseAmount(0.000099)
            })).to.revertedWith('cost fee fail')
        })

        it('Can claim reward with fee', async () => {
            await pool.connect(communityOwner).deposit(parseAmount(1), {
                value: parseAmount(1.0001)
            })

            await mine(10);

            await expect(contracts.Community.connect(communityOwner).withdrawPoolsRewards([pool.address], {
                value: parseAmount(0.0002)
            })).to.changeEtherBalances([owner, communityOwner], [parseAmount(0.0002), parseAmount(-0.0002)])
        })
    })
})