const { expect } = require("chai");
const { ethers } = require('hardhat');

// describe("CurageGauge", async () => {
//     let mintablePoint;
//     let owner;
//     let wh3;
//     let community;
//     let transferModifier;
//     let alice;
//     let bob;
//     const MINTER_ROLE = '0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6'
//     const DEFAULT_ADMIN_ROLE = '0x0000000000000000000000000000000000000000000000000000000000000000'
//     const TRANSFER_ROLE = '0x8502233096d909befbda0999bb8ea2f3a6be3c138b9fbf003752a4c8bce86f6c'
//     const BURN_ROLE = '0xe97b137254058bd94f28d2f3eb79e2d34074ffb488d042e3bc958e0a57d2fa22'

//     const ERR_NOT_A_MINTER = "ERC20PresetMinterPauser: must have minter role to mint";
//     const ERR_CAN_NOT_SEND_POINT = "You has no right to send point";
//     const ERR_CAN_NOT_SET_SENDER = "You can't set sender.";
//     const ERR_CAN_NOT_SET_SENDER_FOR_EVER = "Can't change senders forever";

//     beforeEach(async () => {
//         [owner, wh3, community, transferModifier, alice, bob] = await ethers.getSigners();
//         const MintablePoint = await ethers.getContractFactory("MintablePoint");
//         mintablePoint = await MintablePoint.deploy(transferModifier.address, "test", "TS", ethers.utils.parseEther("100000"), owner.address, community.address);
//         await mintablePoint.deployed();
//     })

//     describe("Deployment", function () {
//         it("Should set the right transferModifier", async () => {
//             expect(await mintablePoint.transferModifier()).to.equal(transferModifier.address);
//         });

//         it("Should set the right admin role", async () => {
//             expect(await mintablePoint.hasRole(DEFAULT_ADMIN_ROLE, community.address)).to.equal(true);
//         })
//     })

//     describe("Transfer", () => {
//         it("Should not mint by anyone without MINTROLE", async () => {
//             // get alice's blance
//             const initialBalance = await mintablePoint.balanceOf(alice.address);
//             // cant mint from a address without minter role
//             await expect(
//                 mintablePoint.connect(community)
//                 .mint(alice.address, ethers.utils.parseEther("10"))
//             )
//             .to.be.revertedWith(ERR_NOT_A_MINTER);
//             // alice's balance not changed
//             expect(await mintablePoint.balanceOf(alice.address)).to.equal(
//                 initialBalance
//             )
//         });

//         it("Should transfer with sender permit", async () => {
//             const initialBalance = await mintablePoint.balanceOf(owner.address);
//             console.log('Owner balance:', ethers.utils.formatUnits(initialBalance));
//             // cant transfer out from a non-sender-role address
//             await expect(
//                 mintablePoint.connect(owner).transfer(bob.address, ethers.utils.parseEther("10"))
//             ).to.be.revertedWith(ERR_CAN_NOT_SEND_POINT);

//             expect(
//                 await mintablePoint.balanceOf(owner.address)
//             ).to.equal(initialBalance);
//         })

//         it("Only transferModifier can set senders", async () => {
//             await mintablePoint.connect(transferModifier).setSender(owner.address, true)

//             // now then sender can transfer tokens
//             expect(
//                 await mintablePoint.connect(owner).transfer(alice.address, 100)
//             ).to.changeTokenBalance(mintablePoint, [owner, alice], [-100, 100]);

//             // others address cant set senders
//             await expect(
//                 mintablePoint.connect(alice).setSender(bob.address, true)
//             ).to.be.revertedWith(ERR_CAN_NOT_SET_SENDER);
//         })

//         it("Cant set sender when the modifier renounce his role", async () => {
//             // modifier can set sender before
//             await mintablePoint.connect(transferModifier).setSender(owner.address, true)
//             // modifier renouce his role
//             await mintablePoint.connect(transferModifier).renounceModifyRole();
//             // now he cant set sender
//             await expect(
//                 mintablePoint.connect(transferModifier).setSender(owner.address, false)
//             ).to.be.revertedWith(ERR_CAN_NOT_SET_SENDER_FOR_EVER);
//         })
//     })
// })