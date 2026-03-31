const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const deployCommunity = require("./create-community");

describe("Create community", async () => {
  let contracts;
  let communityOwner;
  let alice;

  beforeEach(async () => {
    contracts = await loadFixture(deployCommunity);
    communityOwner = contracts.communityOwner;
    alice = contracts.alice;
  });

  function erc20PoolMeta(tokenAddress) {
    return ethers.utils.solidityPack(["address"], [tokenAddress]);
  }

  describe("Create", () => {
    it("Community owner is set from factory", async () => {
      expect(await contracts.Community.owner()).to.equal(communityOwner.address);
    });
  });

  describe("Create pools", () => {
    it("Community owner can add ERC20 pool", async () => {
      const meta = erc20PoolMeta(contracts.CToken.address);
      await contracts.Community.connect(communityOwner).adminAddPool(
        "Stake ERC20",
        [10000],
        contracts.ERC20StakingFactory.address,
        meta,
        { value: 0 }
      );
    });

    it("Non-owner cannot add pool", async () => {
      const meta = erc20PoolMeta(contracts.CToken.address);
      await expect(
        contracts.Community.adminAddPool(
          "Stake ERC20",
          [10000],
          contracts.ERC20StakingFactory.address,
          meta,
          { value: 0 }
        )
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("User can deposit into ERC20 staking pool", async () => {
      const meta = erc20PoolMeta(contracts.CToken.address);
      const tx = await contracts.Community.connect(communityOwner).adminAddPool(
        "Stake ERC20",
        [10000],
        contracts.ERC20StakingFactory.address,
        meta,
        { value: 0 }
      );
      const receipt = await tx.wait();
      const event = receipt.events.find((e) => e.event === "AdminSetPoolRatio");
      const poolAddress = event.args.pools[0];

      await contracts.CToken.connect(communityOwner).transfer(alice.address, 1000);
      await contracts.CToken.connect(alice).approve(poolAddress, 100000);
      const poolContract = await ethers.getContractAt("ERC20Staking", poolAddress);
      await poolContract.connect(alice).deposit(1000, { value: 0 });
      expect(await poolContract.getUserStakedAmount(alice.address)).to.equal(1000);
    });
  });
});
