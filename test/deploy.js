const { ethers } = require("hardhat");

async function deployMintableERC20FactoryContract() {
  const factory = await ethers.getContractFactory("MintableERC20Factory");
  const contract = await factory.deploy();
  await contract.waitForDeployment();
  return contract;
}

async function deploySPStakingFactoryContract(communityFactoryAddress) {
  const factory = await ethers.getContractFactory("SPStakingFactory");
  const contract = await factory.deploy(communityFactoryAddress);
  await contract.waitForDeployment();
  return contract;
}

async function deployERC20StakingFactoryContract(communityFactoryAddress) {
  const factory = await ethers.getContractFactory("ERC20StakingFactory");
  const contract = await factory.deploy(communityFactoryAddress);
  await contract.waitForDeployment();
  return contract;
}

async function deployERC20LockingFactoryContract(communityFactoryAddress) {
  const factory = await ethers.getContractFactory("ERC20LockingFactory");
  const contract = await factory.deploy(communityFactoryAddress);
  await contract.waitForDeployment();
  return contract;
}

async function deployERC1155StakingFactoryContract(communityFactoryAddress) {
  const factory = await ethers.getContractFactory("ERC1155StakingFactory");
  const contract = await factory.deploy(communityFactoryAddress);
  await contract.waitForDeployment();
  return contract;
}

async function deployCommitteeContract(feeRecipient) {
  const factory = await ethers.getContractFactory("Committee");
  const contract = await factory.deploy(feeRecipient);
  await contract.waitForDeployment();
  return contract;
}

async function deployCommunityFactoryContract(committee) {
  const factory = await ethers.getContractFactory("CommunityFactory");
  const committeeAddr = await committee.getAddress();
  const contract = await factory.deploy(committeeAddr);
  await contract.waitForDeployment();
  return contract;
}

async function deployLinearCalculatorContract(communityFactory) {
  const factory = await ethers.getContractFactory("LinearCalculator");
  const cfAddr = await communityFactory.getAddress();
  const contract = await factory.deploy(cfAddr);
  await contract.waitForDeployment();
  return contract;
}

async function deployLinearTimeCalculatorContract(communityFactory) {
  const factory = await ethers.getContractFactory("LinearTimeCalculator");
  const cfAddr = await communityFactory.getAddress();
  const contract = await factory.deploy(cfAddr);
  await contract.waitForDeployment();
  return contract;
}

/** 与生产 Ignition 部署一致：含 SocialCurationFactory 并加入 Committee 白名单 */
async function deploySocialCurationFactory(communityFactory, claimSignerAddr) {
  const factory = await ethers.getContractFactory("SocialCurationFactory");
  const cfAddr = await communityFactory.getAddress();
  const contract = await factory.deploy(cfAddr, claimSignerAddr);
  await contract.waitForDeployment();
  return contract;
}

async function deploy(owner) {
  const signers = await ethers.getSigners();
  // 与 test-social-curation 一致：第 5 个账户作为链下 claim 签名者（无则回退为 owner）
  const claimSignerAddr =
    signers.length > 4 ? signers[4].address : owner.address;
  const feeRecipient = owner.address;
  const Committee = await deployCommitteeContract(feeRecipient);
  await Committee.adminSetFeeRecipient(feeRecipient);
  // 测试用 harness：链上操作为 0 fee，避免每笔带 value
  await Committee.adminSetCreateCommunityFee(0);
  await Committee.adminSetCommunitySettingsFee(0);
  await Committee.adminSetPoolOperationFee(0);

  const MintableERC20Factory = await deployMintableERC20FactoryContract();
  const CommunityFactory = await deployCommunityFactoryContract(Committee);
  const cfAddr = await CommunityFactory.getAddress();
  const ERC20StakingFactory = await deployERC20StakingFactoryContract(cfAddr);
  const ERC20LockingFactory = await deployERC20LockingFactoryContract(cfAddr);
  const ERC1155StakingFactory = await deployERC1155StakingFactoryContract(cfAddr);
  const SPStakingFactory = await deploySPStakingFactoryContract(cfAddr);
  const LinearCalculator = await deployLinearCalculatorContract(CommunityFactory);
  const LinearTimeCalculator = await deployLinearTimeCalculatorContract(
    CommunityFactory
  );

  const SocialCurationFactory = await deploySocialCurationFactory(
    CommunityFactory,
    claimSignerAddr
  );

  const mAddr = await MintableERC20Factory.getAddress();
  const lcAddr = await LinearCalculator.getAddress();
  const ltAddr = await LinearTimeCalculator.getAddress();
  const e20sAddr = await ERC20StakingFactory.getAddress();
  const e20lAddr = await ERC20LockingFactory.getAddress();
  const e1155Addr = await ERC1155StakingFactory.getAddress();
  const spAddr = await SPStakingFactory.getAddress();
  const scAddr = await SocialCurationFactory.getAddress();

  await Committee.adminAddContract(mAddr);
  await Committee.adminAddContract(lcAddr);
  await Committee.adminAddContract(ltAddr);
  await Committee.adminAddContract(e20sAddr);
  await Committee.adminAddContract(e20lAddr);
  await Committee.adminAddContract(e1155Addr);
  await Committee.adminAddContract(spAddr);
  await Committee.adminAddContract(scAddr);

  return {
    Committee,
    MintableERC20Factory,
    CommunityFactory,
    ERC20StakingFactory,
    ERC20LockingFactory,
    ERC1155StakingFactory,
    SPStakingFactory,
    SocialCurationFactory,
    LinearCalculator,
    LinearTimeCalculator,
  };
}

module.exports = deploy;
