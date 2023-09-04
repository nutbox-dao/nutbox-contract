require('dotenv').config();
// const ethers = require('ethers');
const { ethers, helpers } = require('hardhat');

// const NUTAddress = '0x3a51Ac476B2505F386546450822F1bF9d881bEa4' // localhost
// const NUTAddress = '0xc821eC39fd35E6c8414A6C7B32674D51aD0c2468' // goerli
// const NUTAddress = '0x39ab47b7F6D2B6874157750440b4948786066283'  // Linea
const NUTAddress = '0xA643e598364A9dFB3328aD2E70AF6f9E3C477A42'  // base

async function deployNutContract() {
    const NUTToken = await ethers.getContractFactory('NUTToken');
    const nutToken = await NUTToken.deploy(
        'Nutbox',
        'NUT',
        '0',
        '0x2DaE3A44D3C6e9Ab402f6e616ce1d02c1836A6Ac'
    );
    await nutToken.deployed();
    console.log('✓ NUTToken contract deployed:', nutToken.address);
    return nutToken;
}
async function main() {
    const contract = await deployNutContract();

    const tx = await contract.enableTransfer();
    console.log(tx.hash);
}

main()
  .catch(console.error)
  .finally(() => process.exit());