const { expect } = require("chai");
const { ethers, helpers } = require('hardhat');
const deploy = require('./deploy');
const hre = require("hardhat");
const { mine, loadFixture, mineUpTo } = require("@nomicfoundation/hardhat-network-helpers");
const deployCommunity = require('./create-community')

describe("Taxed ERC20 staking", async () => {
    let contracts;
    let owner;
    let communityOwner;
    let taxedERC20Factory;
    let nut;
    let alice;
    let bob;

    beforeEach(async () => {
        contracts = await loadFixture(deployCommunity)
        owner = contracts.owner;
        communityOwner = contracts.communityOwner;
        taxedERC20Factory = contracts.TaxedERC20StakingFactory;
        nut = contracts.nut;
        alice = contracts.alice;
        bob = contracts.bob;
    })

    async function createTaxedERC20Pool(token)  {
        const tx = await contracts.Community.connect(communityOwner).adminAddPool("Taxed pool 1", [10000], taxedERC20Factory.address, token);
        const receipt = await tx.wait();
        const event = receipt.events.find(e => e.event === 'AdminSetPoolRatio')
        const poolAddress = event.args.pools[0]
        return poolAddress;
    }

    describe("Create pool", () => {
        it("Community Owner can create pool", async () => {
            await contracts.Community.connect(communityOwner).adminAddPool("Stake ERC20", [10000], contracts.ERC20StakingFactory.address, contracts.CToken.address);
        })

        it("Other one cant create pool", async () => {
            await expect(contracts.Community.adminAddPool("Stake ERC20", [10000], contracts.ERC20StakingFactory.address, contracts.CToken.address))
                .to.be.revertedWith("Ownable: caller is not the owner");
        })

        it("Community owner can create taxed erc20 staking pool", async () => {
            const poolAddress = await createTaxedERC20Pool(contracts.nut.address);
            // rearch over the start block
            await mine(100);
        })
    })

    describe("Deposit", () => {
        it("Cant deposit if user has insufficient balance", async () => {
            const poolAddress = await createTaxedERC20Pool(contracts.CToken.address);
            const poolContract = await ethers.getContractAt("TaxedERC20Staking", poolAddress);
            await mine(100);
            // any one can start the pool
            await contracts.CToken.connect(owner).approve(poolAddress, '1000000000000000000000000');

            // deposit
            await expect(poolContract.connect(owner).deposit('1000000000000000000000'))
            .to.be.revertedWith('ERC20: call failed');
        });

        it("Everyone can deposit if he has balance", async () => {
            const poolAddress = await createTaxedERC20Pool(contracts.CToken.address);
            const poolContract = await ethers.getContractAt("TaxedERC20Staking", poolAddress);
            await mine(100);
            // any one can start the pool
            await contracts.CToken.connect(owner).approve(poolAddress, '1000000000000000000000000');
            await contracts.CToken.connect(communityOwner).approve(poolAddress, '1000000000000000000000000');

            await contracts.CToken.connect(communityOwner).transfer(owner.address, '5000000000000000000000');
            // deposit
            await poolContract.connect(owner).deposit('1000000000000000000000');
            await poolContract.connect(communityOwner).deposit('1000000000000000000000');
        });

        it("Every deposit will cost fee", async () => {
            const poolAddress = await createTaxedERC20Pool(contracts.CToken.address);
            const poolContract = await ethers.getContractAt("TaxedERC20Staking", poolAddress);
            await mine(100);
            await contracts.CToken.connect(communityOwner).transfer(alice.address, '5000000000000000000000');

            await contracts.CToken.connect(alice).approve(poolAddress, '1000000000000000000000000');

            await expect(poolContract.connect(alice).deposit('10000')).changeTokenBalances(
                contracts.CToken,
                [communityOwner.address, owner.address, poolAddress, alice],
                [200, 50, 9750, -10000]
            );

            expect(await poolContract.getUserStakedAmount(alice.address)).to.be.equals(9750);
            expect(await poolContract.getTotalStakedAmount()).to.be.equals(9750);
        })
    });

    describe("Withdraw", () => {
        it("Every withdraw will cost fee", async () => {
            const poolAddress = await createTaxedERC20Pool(contracts.CToken.address);
            const poolContract = await ethers.getContractAt("TaxedERC20Staking", poolAddress);
            await mine(100);
            await contracts.CToken.connect(communityOwner).transfer(alice.address, '5000000000000000000000');

            await contracts.CToken.connect(alice).approve(poolAddress, '1000000000000000000000000');

            await expect(poolContract.connect(alice).deposit('10000')).changeTokenBalances(
                contracts.CToken,
                [communityOwner.address, owner.address, poolAddress, alice],
                [200, 50, 9750, -10000]
            );

            expect(await poolContract.getUserStakedAmount(alice.address)).to.be.equals(9750);
            expect(await poolContract.getTotalStakedAmount()).to.be.equals(9750);

            await expect(poolContract.connect(alice).withdraw(5000)).changeTokenBalances(
                contracts.CToken,
                [communityOwner.address, owner.address, poolAddress, alice],
                [100, 25, -5000, 4875]
            )
        })
    })
})