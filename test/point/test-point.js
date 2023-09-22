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
    })
})