const { expect } = require("chai");
const { ethers, helpers } = require('hardhat');
const deploy = require('./deploy');
const hre = require("hardhat");
const { mine, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
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
            const tx = await contracts.Community.connect(communityOwner).adminAddPool("Wormhole3 curation", [10000], contracts.CurationGaugeFactory.address, bob.address);
            const receipt = await tx.wait();
            const event = receipt.events.find(e => e.event === 'AdminSetPoolRatio')
            const poolAddress = event.args.pools[0]
            await mine(2000);

            const poolContract = await ethers.getContractAt("CurationGauge", poolAddress);
            await poolContract.withdrawRewardsToRecipient();
            const balance = await contracts.CToken.balanceOf(bob.address);
            console.log(53, balance);
        })
    })
})