require('dotenv').config();
// const ethers = require('ethers');
const { ethers, helpers } = require('hardhat');

// const NUTAddress = '0x3a51Ac476B2505F386546450822F1bF9d881bEa4' // localhost
// const NUTAddress = '0xc821eC39fd35E6c8414A6C7B32674D51aD0c2468' // goerli
// const NUTAddress = '0x39ab47b7F6D2B6874157750440b4948786066283'  // Linea

async function deployPoinFactoryContract() {
    const PointFactory = await ethers.getContractFactory('PointFactory');
    const pointFactory = await PointFactory.deploy();
    await pointFactory.deployed();
    console.log('✓ NUTToken contract deployed:', pointFactory.address);
    return pointFactory;
}
async function main() {
    const contract = await deployPoinFactoryContract();

}

main()
  .catch(console.error)
  .finally(() => process.exit());