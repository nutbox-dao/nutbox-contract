const { expect } = require("chai");
const { ethers, helpers } = require('hardhat');
const deploy = require('./deploy');
const hre = require("hardhat");
const { mine, loadFixture, mineUpTo, time } = require("@nomicfoundation/hardhat-network-helpers");
const deployCommunity = require('./create-community')


describe("Point", async () => {
    let contracts;
    let owner;
    let communityOwner;
    let alice;
    let bob;
    const TRANSFER_ROLE = '0x8502233096d909befbda0999bb8ea2f3a6be3c138b9fbf003752a4c8bce86f6c'


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
        });
    })

    describe("Fund", () => {
        it("Admin can set fund ratio", async () => {
            await contracts.Community.connect(communityOwner).adminSetFeeRatio(10000);
        });

        it("Admin can set dev", async () => {
            await contracts.Community.connect(communityOwner).adminSetDev(alice.address);
        });
    })

    describe("Ctoken", () => {
        it("Can't transfer point when it not started", async () => {
            let balance = await contracts.CToken.balanceOf(communityOwner.address);
            await expect(contracts.CToken.connect(communityOwner).transfer(alice.address, 1000000000)).to.be.revertedWith(
                "Token can't tradable right now"
            );
        });

        it("Can transfer point when it started", async () => {
            let balance = await contracts.CToken.balanceOf(communityOwner.address);
            await time.increase(400);
            console.log(await contracts.CToken.startTradableTime());
            await expect(contracts.CToken.connect(communityOwner).transfer(alice.address, 1000000000)).changeTokenBalance(contracts.CToken,
                alice, 1000000000);

            await expect(contracts.CToken.connect(alice).transfer(communityOwner.address, 500)).changeTokenBalance(
                contracts.CToken, communityOwner, 500
            )
        });

        it("Transfer admin can set address tradable before token start", async () => {
            await contracts.CToken.connect(communityOwner).grantRole(TRANSFER_ROLE, alice.address);
            await expect(contracts.CToken.connect(communityOwner).transfer(alice.address, 10000)).changeTokenBalance(
                contracts.CToken, alice, 10000
            );
            await expect(contracts.CToken.connect(alice).transfer(bob.address, 1000)).changeTokenBalance(
                contracts.CToken, bob, 1000
            );
        })
    })

    describe("Create pools", () => {

        it("Community owner can create curation pool, can only claim to the recepient, and owner can claim revenue", async () => {
            const poolAddress = await createCurationGauge(bob.address)
            // rearch over the start block
            await mine(100);
            await contracts.CToken.connect(communityOwner).grantRole(TRANSFER_ROLE, bob.address); 
            await contracts.Community.connect(communityOwner).adminSetFeeRatio(2000);
            expect(await contracts.CToken.balanceOf(bob.address)).to.equal(0)

            const poolContract = await ethers.getContractAt("CurationGauge", poolAddress);
            // start curation
            await poolContract.startPool();
            // in the first start block, anyone can claim a block reward
            await expect(poolContract.withdrawRewardsToRecipient()).changeTokenBalance(contracts.CToken, bob, "80000000000000000000");
            // another reward of a block
            await expect(poolContract.withdrawRewardsToRecipient()).changeTokenBalance(contracts.CToken, bob, "80000000000000000000");
            
            await mine(1);
            // 2 block reward
            await expect(poolContract.withdrawRewardsToRecipient()).changeTokenBalance(contracts.CToken, bob, "160000000000000000000");
            await mine(1);
            expect(await contracts.Community.getPoolPendingRewards(poolAddress, poolAddress)).equal("80000000000000000000");
            
            await expect(contracts.Community.connect(communityOwner).adminWithdrawRevenue()).changeTokenBalance(
                contracts.CToken, communityOwner, "100000000000000000000"
            )
        })
    })
})