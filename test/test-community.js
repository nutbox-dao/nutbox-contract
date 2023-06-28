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

    beforeEach(async () => {
        contracts = await loadFixture(deployCommunity)
        owner = contracts.owner;
        communityOwner = contracts.communityOwner
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
            try {
                await contracts.Community.adminAddPool("Stake ERC20", [10000], contracts.ERC20StakingFactory.address, contracts.CToken.address);
            }catch(e) {
                expect(e.message).to.equal('VM Exception while processing transaction: revert with reason "Ownable: caller is not the owner"')
            }
        })
    })
})