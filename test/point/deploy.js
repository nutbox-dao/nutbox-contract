const { expect } = require("chai");
const { ethers } = require('hardhat');

async function deployNut(owner) {
    let factory = await ethers.getContractFactory('NUTToken');
    const nut = await factory.deploy('Nutbox', 'NUT', ethers.utils.parseUnits("2000000", 18),
    owner.address);
    await nut.deployed();
    return nut;
}

async function deployCommitteeContract(owner, nut) {
    let factory = await ethers.getContractFactory('Committee');
    let contract = await factory.deploy(owner.address, nut.address);
    await contract.deployed();
    // console.log("✓ Committee contract deployed", contract.address);
    return contract;
}

async function deployPointFactoryContract() {
    let factory = await ethers.getContractFactory('PointFactory')
    let contract = await factory.deploy()
    await contract.deployed();
    // console.log("✓ Point ERC20 contract deployed", contract.address);
    return contract;
}

async function deployNutPowerContract(nut) {
    let factory = await ethers.getContractFactory('NutPower')
    let contract = await factory.deploy(nut.address);
    await contract.deployed();
    // console.log("✓ Nut power contract deployed", contract.address);
    return contract;
}

async function deploySPStakingFactoryContract(CommunityFactoryAddress) {
    let factory = await ethers.getContractFactory('SPStakingFactoryContract')
    let contract = await factory.deploy(CommunityFactoryAddress);
    await contract.deployed();
    // console.log("✓ SPStakingFactory contract deployed", contract.address);
    return contract
}

async function deployERC20StakingFactoryContract(CommunityFactoryAddress) {
    let factory = await ethers.getContractFactory('ERC20StakingFactory')
    let contract = await factory.deploy(CommunityFactoryAddress);
    await contract.deployed();
    // console.log("✓ ERC20StakingFactory contract deployed", contract.address);
    return contract;
}

async function deployERC1155StakingFactoryContract(CommunityFactoryAddress) {
    let factory = await ethers.getContractFactory('ERC1155StakingFactory')
    let contract = await factory.deploy(CommunityFactoryAddress);
    await contract.deployed();
    // console.log("✓ ERC1155StakingFactory contract deployed", contract.address);
    return contract;
}

async function deployCosmosStakingFactoryContract(CommunityFactoryAddress) {
    let factory = await ethers.getContractFactory('CosmosStakingFactory');
    let contract = await factory.deploy(CommunityFactoryAddress);
    await contract.deployed();
    // console.log("✓ CosmosStakingFactory contract deployed", contract.address);
    return contract;
}

async function deployCommunityFactoryContract(Committee) {
    let factory = await ethers.getContractFactory("CommunityFactory");
    let contract = await factory.deploy(Committee.address);
    await contract.deployed();
    // console.log("✓ CommunityFactory contract deployed", contract.address);
    return contract;
}

async function deployGaugeContract(CommunityFactory, NutPowerAddress, NutAddress) {
    let factory = await ethers.getContractFactory('Gauge');
    let contract = await factory.deploy(CommunityFactory.address, 0, {
        community: 5000,
        poolFactory: 0,
        user: 5000
    }, NutPowerAddress, NutAddress)
    await contract.deployed();
    // console.log("✓ Gauge contract deployed", contract.address);
    return contract;
}

async function deployLinearCalculatorContract(CommunityFactory) {
    let factory = await ethers.getContractFactory("LinearCalculator");
    let contract = await factory.deploy(CommunityFactory.address);
    await contract.deployed();
    // console.log("✓ LinearCalculator contract deployed", contract.address);
    return contract;
}

async function deployTreasuryFactoryContract(CommunityFactory) {
    let factory = await ethers.getContractFactory("TreasuryFactory")
    let contract = await factory.deploy(CommunityFactory.address);
    await contract.deployed();
    // console.log("✓ TreasuryFactory contract deployed", contract.address);
    return contract
}

async function deployCurationGaugeContract(CommunityFactory) {
    let factory = await ethers.getContractFactory('CurationGaugeFactory');
    let contract = await factory.deploy(CommunityFactory.address);
    await contract.deployed();
    // console.log("✓ CurationGauge contract deployed", contract.address);
    return contract
}

async function deploy(owner) {
    let result = {};
    // deploy contract
    result.nut = await deployNut(owner);
    result.Committee = await deployCommitteeContract(owner, result.nut);
    result.PointFactory = await deployPointFactoryContract();
    result.NutPower = await deployNutPowerContract(result.nut);
    result.CommunityFactory = await deployCommunityFactoryContract(result.Committee);
    result.ERC20StakingFactory = await deployERC20StakingFactoryContract(result.CommunityFactory.address);
    result.CurationGaugeFactory = await deployCurationGaugeContract(result.CommunityFactory);
    result.LinearCalculator = await deployLinearCalculatorContract(result.CommunityFactory);
    result.Gauge = await deployGaugeContract(result.CommunityFactory, result.NutPower.address, result.nut.address)
    result.TreasuryFactory = await deployTreasuryFactoryContract(result.CommunityFactory)

    // set contract
    await result.Committee.adminAddWhitelistManager(result.CommunityFactory.address);

    await result.Committee.adminAddContract(result.PointFactory.address);
    await result.Committee.adminAddContract(result.LinearCalculator.address);
    await result.Committee.adminAddContract(result.ERC20StakingFactory.address);
    await result.Committee.adminAddContract(result.CurationGaugeFactory.address);

    await result.Committee.adminSetGauge(result.Gauge.address);

    await result.NutPower.adminSetWhitelist(result.Gauge.address, true);

    return result;
}

module.exports = deploy;