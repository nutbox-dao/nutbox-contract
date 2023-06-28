const { expect } = require("chai");
const { ethers } = require('hardhat');
const deploy = require('./deploy');

describe("Create community", async () => {
    let contracts;
    let owner;
    let communityOwner;

    beforeEach(async () => {
        [owner, communityOwner] = await ethers.getSigners();
        contracts = await deploy(owner);
    })

    describe("Create", () => {
        it("Any one can create a community", async () => {
            // config token info
            
        })
    })
})