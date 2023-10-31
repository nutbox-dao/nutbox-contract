const { ethers, helpers } = require('hardhat');

/**
 * deployed at : 5976605
 * tx: 0x9a2b9f4177ae7c4fc2ead232889e8d9a4920b7950a3f6a972af1c741d73ac89d
 * contract: 0x9C2804015b55D02F0cBeDa1ee8a9c24Ee7aF00d7
 */

async function main() {
    const TaxedERC20StakingFactory = await ethers.getContractFactory('TaxedERC20StakingFactory');
    const taxedERC20StakingFactory = await TaxedERC20StakingFactory.deploy('0xFe992EF5f73Ac289052F1742B918278a62686fD1');
    await taxedERC20StakingFactory.deployed();
    console.log('address:', taxedERC20StakingFactory.address);

}

main()
   .then(() => process.exit(0))
   .catch((error) => {
      console.error(error);
      process.exit(1);
   });