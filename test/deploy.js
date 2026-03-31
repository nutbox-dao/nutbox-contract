const { ethers } = require("hardhat");

async function deployMintableERC20FactoryContract() {
  const factory = await ethers.getContractFactory("MintableERC20Factory");
  const contract = await factory.deploy();
  return contract;
}

async function deployPoolTemplate(name) {
  const factory = await ethers.getContractFactory(name);
  const contract = await factory.deploy();
  return contract;
}

async function deploySPStakingFactoryContract(communityFactoryAddress, spTemplateAddress) {
  const factory = await ethers.getContractFactory("SPStakingFactory");
  const contract = await factory.deploy(communityFactoryAddress, spTemplateAddress);
  return contract;
}

async function deployERC20StakingFactoryContract(communityFactoryAddress, erc20TemplateAddress) {
  const factory = await ethers.getContractFactory("ERC20StakingFactory");
  const contract = await factory.deploy(communityFactoryAddress, erc20TemplateAddress);
  return contract;
}

async function deployERC20LockingFactoryContract(communityFactoryAddress, lockingTemplateAddress) {
  const factory = await ethers.getContractFactory("ERC20LockingFactory");
  const contract = await factory.deploy(communityFactoryAddress, lockingTemplateAddress);
  return contract;
}

async function deployERC1155StakingFactoryContract(communityFactoryAddress, erc1155TemplateAddress) {
  const factory = await ethers.getContractFactory("ERC1155StakingFactory");
  const contract = await factory.deploy(communityFactoryAddress, erc1155TemplateAddress);
  return contract;
}

async function deployCommitteeContract(feeRecipient) {
  const factory = await ethers.getContractFactory("Committee");
  const contract = await factory.deploy(feeRecipient);
  return contract;
}

async function deployCommunityFactoryContract(committee, communityTemplateAddress) {
  const factory = await ethers.getContractFactory("CommunityFactory");
  const contract = await factory.deploy(committee.address, communityTemplateAddress);
  return contract;
}

async function deployLinearCalculatorContract(communityFactory) {
  const factory = await ethers.getContractFactory("LinearCalculator");
  const contract = await factory.deploy(communityFactory.address);
  return contract;
}

async function deploy(owner) {
  const feeRecipient = owner.address;
  const Committee = await deployCommitteeContract(feeRecipient);
  await Committee.adminSetFeeRecipient(feeRecipient);

  const communityTemplate = await deployPoolTemplate("Community");
  const erc20Template = await deployPoolTemplate("ERC20Staking");
  const lockingTemplate = await deployPoolTemplate("ERC20Locking");
  const erc1155Template = await deployPoolTemplate("ERC1155Staking");
  const spTemplate = await deployPoolTemplate("SPStaking");

  const MintableERC20Factory = await deployMintableERC20FactoryContract();
  const CommunityFactory = await deployCommunityFactoryContract(Committee, communityTemplate.address);
  const ERC20StakingFactory = await deployERC20StakingFactoryContract(CommunityFactory.address, erc20Template.address);
  const ERC20LockingFactory = await deployERC20LockingFactoryContract(CommunityFactory.address, lockingTemplate.address);
  const ERC1155StakingFactory = await deployERC1155StakingFactoryContract(CommunityFactory.address, erc1155Template.address);
  const SPStakingFactory = await deploySPStakingFactoryContract(CommunityFactory.address, spTemplate.address);
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
