const { ethers } = require("hardhat");

async function deployMintableERC20FactoryContract() {
  const factory = await ethers.getContractFactory("MintableERC20Factory");
  const contract = await factory.deploy();
  await contract.deployed();
  return contract;
}

async function deploySPStakingFactoryContract(communityFactoryAddress) {
  const factory = await ethers.getContractFactory("SPStakingFactory");
  const contract = await factory.deploy(communityFactoryAddress);
  await contract.deployed();
  return contract;
}

async function deployERC20StakingFactoryContract(communityFactoryAddress) {
  const factory = await ethers.getContractFactory("ERC20StakingFactory");
  const contract = await factory.deploy(communityFactoryAddress);
  await contract.deployed();
  return contract;
}

async function deployERC20LockingFactoryContract(communityFactoryAddress) {
  const factory = await ethers.getContractFactory("ERC20LockingFactory");
  const contract = await factory.deploy(communityFactoryAddress);
  await contract.deployed();
  return contract;
}

async function deployERC1155StakingFactoryContract(communityFactoryAddress) {
  const factory = await ethers.getContractFactory("ERC1155StakingFactory");
  const contract = await factory.deploy(communityFactoryAddress);
  await contract.deployed();
  return contract;
}

async function deployCommitteeContract(feeRecipient) {
  const factory = await ethers.getContractFactory("Committee");
  const contract = await factory.deploy(feeRecipient);
  await contract.deployed();
  return contract;
}

async function deployCommunityFactoryContract(committee) {
  const factory = await ethers.getContractFactory("CommunityFactory");
  const contract = await factory.deploy(committee.address);
  await contract.deployed();
  return contract;
}

async function deployLinearCalculatorContract(communityFactory) {
  const factory = await ethers.getContractFactory("LinearCalculator");
  const contract = await factory.deploy(communityFactory.address);
  await contract.deployed();
  return contract;
}

async function deploy(owner) {
  const feeRecipient = owner.address;
  const Committee = await deployCommitteeContract(feeRecipient);
  const MintableERC20Factory = await deployMintableERC20FactoryContract();
  const CommunityFactory = await deployCommunityFactoryContract(Committee);
  const ERC20StakingFactory = await deployERC20StakingFactoryContract(CommunityFactory.address);
  const ERC20LockingFactory = await deployERC20LockingFactoryContract(CommunityFactory.address);
  const ERC1155StakingFactory = await deployERC1155StakingFactoryContract(CommunityFactory.address);
  const SPStakingFactory = await deploySPStakingFactoryContract(CommunityFactory.address);
  const LinearCalculator = await deployLinearCalculatorContract(CommunityFactory);

  await Committee.adminAddContract(MintableERC20Factory.address);
  await Committee.adminAddContract(LinearCalculator.address);
  await Committee.adminAddContract(ERC20StakingFactory.address);
  await Committee.adminAddContract(ERC20LockingFactory.address);
  await Committee.adminAddContract(ERC1155StakingFactory.address);
  await Committee.adminAddContract(SPStakingFactory.address);

  return {
    Committee,
    MintableERC20Factory,
    CommunityFactory,
    ERC20StakingFactory,
    ERC20LockingFactory,
    ERC1155StakingFactory,
    SPStakingFactory,
    LinearCalculator,
  };
}

module.exports = deploy;
