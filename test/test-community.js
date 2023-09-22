const { expect } = require("chai");
const { ethers, helpers } = require('hardhat');
const deploy = require('./deploy');
const hre = require("hardhat");
const { mine, loadFixture, mineUpTo } = require("@nomicfoundation/hardhat-network-helpers");
const deployCommunity = require('./create-community')

describe("Create community", async () => {
    let contracts;
    let owner;
    let communityOwner;
    let alice;
    let bob;

    beforeEach(async () => {
        contracts = await loadFixture(deployCommunity)
        owner = contracts.owner;
        communityOwner = contracts.communityOwner;
        alice = contracts.alice;
        bob = contracts.bob;
    })

    async function createCurationGauge(receiption)  {
        const tx = await contracts.Community.connect(communityOwner).adminAddPool("Wormhole3 curation", [10000], contracts.CurationGaugeFactory.address, receiption);
        const receipt = await tx.wait();
        const event = receipt.events.find(e => e.event === 'AdminSetPoolRatio')
        const poolAddress = event.args.pools[0]
        return poolAddress;
    }

    describe("Create", () => {
        it("Any one can create a community", async () => {
            expect(await contracts.Community.owner()).to.equal(communityOwner.address)
        })
    })

    describe("Create pools", () => {
        it("Community Owner can create pool", async () => {
            await contracts.Community.connect(communityOwner).adminAddPool("Stake ERC20", [10000], contracts.ERC20StakingFactory.address, contracts.CToken.address);
        })

        it("Other one cant create pool", async () => {
            await expect(contracts.Community.adminAddPool("Stake ERC20", [10000], contracts.ERC20StakingFactory.address, contracts.CToken.address))
                .to.be.revertedWith("Ownable: caller is not the owner");
        })

        it("Any one can deposit with ERC20 staking pool", async () => {
            const tx = await contracts.Community.connect(communityOwner).adminAddPool("Stake ERC20", [10000], contracts.ERC20StakingFactory.address, contracts.CToken.address);
            const receipt = await tx.wait();
            const event = receipt.events.find(e => e.event === 'AdminSetPoolRatio')
            const poolAddress = event.args.pools[0]
            await mine(2000);
            await expect(contracts.CToken.connect(communityOwner).transfer(alice.address, 1000))
                .to.changeTokenBalances(
                    contracts.CToken,
                    [communityOwner, alice],
                    [-1000, 1000]
                );

            await contracts.CToken.connect(alice).approve(poolAddress, 100000);
            const poolContract = await ethers.getContractAt("ERC20Staking", poolAddress);
            await poolContract.connect(alice).deposit(1000);
            expect(await poolContract.getUserStakedAmount(alice.address)).to.equal(1000);
        })

        it("Community owner can create curation pool", async () => {
            const poolAddress = await createCurationGauge(bob.address)
            // rearch over the start block
            await mine(100);

            expect(await contracts.CToken.balanceOf(bob.address)).to.equal(0)

            const poolContract = await ethers.getContractAt("CurationGauge", poolAddress);
            // start curation
            await poolContract.startPool();
            // in the first start block, anyone can claim a block reward
            await expect(poolContract.withdrawRewardsToRecipient()).changeTokenBalance(contracts.CToken, bob, "100000000000000000000");
            // another reward of a block
            await expect(poolContract.withdrawRewardsToRecipient()).changeTokenBalance(contracts.CToken, bob, "100000000000000000000");
            
            await mine(1);
            // 2 block reward
            await expect(poolContract.withdrawRewardsToRecipient()).changeTokenBalance(contracts.CToken, bob, "200000000000000000000");
            await mine(1);
            expect(await contracts.Community.getPoolPendingRewards(poolAddress, poolAddress)).equal("100000000000000000000");
        })
        
        it("Not started curation gauge has no reward", async () => {
            const poolAddress = await createCurationGauge(bob.address);
            const poolContract = await ethers.getContractAt("CurationGauge", poolAddress);
            // reach over the start block
            await mine(100);
            // there's no reward because the pool not started
            await expect(poolContract.withdrawRewardsToRecipient()).changeTokenBalance(contracts.CToken, bob, "0");
            await mine(1000);
            // no rewards
            await expect(poolContract.withdrawRewardsToRecipient()).changeTokenBalance(contracts.CToken, bob, "0");
            await mine(1000) ;
            // no rewards
            expect(await contracts.Community.getPoolPendingRewards(poolAddress, poolAddress)).to.equal("0");
        })

        it("Cant start curation pool more than once", async () => {
            const poolAddress = await createCurationGauge(bob.address);
            const poolContract = await ethers.getContractAt("CurationGauge", poolAddress);
            await poolContract.startPool();
            // cant start again
            await expect(poolContract.startPool).to.be.revertedWith("Pool has started");
        })

        it("Cant withdraw reward after admin close the pool", async () => {
            const poolAddress = await createCurationGauge(bob.address);
            const poolContract = await ethers.getContractAt("CurationGauge", poolAddress);
            // reach over the start block
            await mine(100)
            await poolContract.startPool();
            await expect(poolContract.withdrawRewardsToRecipient()).changeTokenBalance(contracts.CToken, bob, "100000000000000000000");
            await mine(49);
            expect(await contracts.Community.getPoolPendingRewards(poolAddress, poolAddress)).to.equal("4900000000000000000000");
            await expect(poolContract.withdrawRewardsToRecipient()).changeTokenBalance(contracts.CToken, bob, "5000000000000000000000");
            await mine(1);
            // now there's one block reward
            expect(await contracts.Community.getPoolPendingRewards(poolAddress, poolAddress)).to.equal("100000000000000000000");
            // admin close the pool, block num step 1
            await contracts.Community.connect(communityOwner).adminClosePool(poolAddress, [], []);
            // can claim 2 block reward
            await expect(poolContract.withdrawRewardsToRecipient()).changeTokenBalance(contracts.CToken, bob, "200000000000000000000");
            await mine(100);
            // no reward for ever
            await expect(poolContract.withdrawRewardsToRecipient()).changeTokenBalance(contracts.CToken, bob, "0");
        })

        it("Only community owner can change the curation gauge reciption", async () => {
            const poolAddress = await createCurationGauge(bob.address);
            const poolContract = await ethers.getContractAt("CurationGauge", poolAddress);
            await mine(100);
            // any one can start the pool
            await poolContract.startPool();
            await mine(1);
            expect(await contracts.Community.getPoolPendingRewards(poolAddress, poolAddress)).to.equal("100000000000000000000");
            await expect(poolContract.withdrawRewardsToRecipient()).changeTokenBalance(contracts.CToken, bob, "200000000000000000000");
            await expect(poolContract.connect(bob).adminSetRecipient(alice.address)).to.be.revertedWith("Only the community owner can change recipient");
            expect(await contracts.Community.getPoolPendingRewards(poolAddress, poolAddress)).to.equal("100000000000000000000");
            await poolContract.connect(communityOwner).adminSetRecipient(alice.address);
            expect(await contracts.Community.getPoolPendingRewards(poolAddress, poolAddress)).to.equal("200000000000000000000");
            await expect(poolContract.withdrawRewardsToRecipient()).changeTokenBalance(contracts.CToken, alice, "300000000000000000000");
        })

        it('Multi gauge can get reward by pool ratio', async () => {
            // create pool1
            const poolAddress1 = await createCurationGauge(bob.address);
            const poolContract1 = await ethers.getContractAt("CurationGauge", poolAddress1);

            // create pool2
            const tx = await contracts.Community.connect(communityOwner).adminAddPool("Wormhole3 curation2", [3000, 7000], contracts.CurationGaugeFactory.address, alice.address);
            const receipt = await tx.wait();
            const event = receipt.events.find(e => e.event === 'AdminSetPoolRatio')
            const poolAddress2 = event.args.pools[1];
            const poolContract2 = await ethers.getContractAt("CurationGauge", poolAddress2);

            // start pools
            await poolContract1.connect(communityOwner).startPool();
            await poolContract2.connect(communityOwner).startPool();

            // start distribute
            await mineUpTo(117);
            await mine(1);
            expect(await contracts.Community.getPoolPendingRewards(poolAddress1, poolAddress1)).to.equal('60000000000000000000');
            expect(await contracts.Community.getPoolPendingRewards(poolAddress2, poolAddress2)).to.equal('140000000000000000000');
            await mine(1);
            expect(await contracts.Community.getPoolPendingRewards(poolAddress1, poolAddress1)).to.equal('90000000000000000000');
            expect(await contracts.Community.getPoolPendingRewards(poolAddress2, poolAddress2)).to.equal('210000000000000000000');
            await mine(898);
            // the last block of first step
            expect(await contracts.Community.getPoolPendingRewards(poolAddress1, poolAddress1)).to.equal('27030000000000000000000');
            await mine(1);
            // the second step start
            expect(await contracts.Community.getPoolPendingRewards(poolAddress1, poolAddress1)).to.equal('27045000000000000000000');

            // harvest pool1
            await expect(poolContract1.withdrawRewardsToRecipient()).changeTokenBalance(contracts.CToken, bob, '27060000000000000000000');
            await expect(poolContract2.withdrawRewardsToRecipient()).changeTokenBalance(contracts.CToken, alice, '63175000000000000000000');

            expect(await contracts.Community.getPoolPendingRewards(poolAddress1, poolAddress1)).to.equal('15000000000000000000');
            expect(await contracts.Community.getPoolPendingRewards(poolAddress2, poolAddress2)).to.equal('0');


        })
    })
})