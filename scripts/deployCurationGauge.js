const { ethers, helpers } = require('hardhat');

/**
 * deployed at : 114710992
 * tx: 0x639f93c2725fd6199c696f78b0102293395ac2164fe0e9845f27d11710760aa8
 * contract: 0xFc9AF0eF1bB4673ad48ee477dF231Cc3286e1464
 */

async function main() {
    const CurationGaugeFactory = await ethers.getContractFactory('CurationGaugeFactory');
    const curationGaugeFactory = await CurationGaugeFactory.deploy('0xDB1d3a43B19d0E95EE4fA16486350434A15e8c86');
    await curationGaugeFactory.deployed();
    console.log('address:', curationGaugeFactory.address);
}

main()
   .then(() => process.exit(0))
   .catch((error) => {
      console.error(error);
      process.exit(1);
   });