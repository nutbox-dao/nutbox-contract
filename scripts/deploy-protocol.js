/**
 * 协议全量部署（Hardhat）
 *
 * 用法:
 *   npx hardhat run scripts/deploy-protocol.js --network localhost
 *   FEE_RECIPIENT=0x... SOCIAL_CURATION_CLAIM_SIGNER=0x... npx hardhat run scripts/deploy-protocol.js --network bsc
 *
 * 环境变量（可选）:
 *   FEE_RECIPIENT           — Committee 手续费接收地址，默认部署账户
 *   SOCIAL_CURATION_CLAIM_SIGNER — SocialCuration 链下认领签名者，默认部署账户
 *
 * 输出: deployments/<network>.json
 *
 * 部署后验证源码: 配置 BSCSCAN_API_KEY / ARB_KEY 后执行
 *   npx hardhat run scripts/verify-protocol.js --network <同上网络>
 */
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

async function main() {
  const { ethers, network } = hre;
  const [deployer] = await ethers.getSigners();

  const feeRecipient = process.env.FEE_RECIPIENT || deployer.address;
  const claimSignerAddr =
    process.env.SOCIAL_CURATION_CLAIM_SIGNER || deployer.address;

  if (!ethers.utils.isAddress(feeRecipient)) {
    throw new Error("Invalid FEE_RECIPIENT");
  }
  if (!ethers.utils.isAddress(claimSignerAddr)) {
    throw new Error("Invalid SOCIAL_CURATION_CLAIM_SIGNER");
  }

  console.log("Network:", network.name, "chainId:", network.config.chainId);
  console.log("Deployer:", deployer.address);
  console.log("Fee recipient:", feeRecipient);
  console.log("SocialCuration claim signer:", claimSignerAddr);

  const Committee = await ethers.getContractFactory("Committee");
  const committee = await Committee.deploy(feeRecipient);
  await committee.deployed();
  console.log("Committee:", committee.address);

  // await (await committee.adminSetFeeRecipient(feeRecipient)).wait();

  const MintableERC20Factory = await ethers.getContractFactory(
    "MintableERC20Factory"
  );
  const mintableERC20Factory = await MintableERC20Factory.deploy();
  await mintableERC20Factory.deployed();
  console.log("MintableERC20Factory:", mintableERC20Factory.address);

  const CommunityFactory = await ethers.getContractFactory("CommunityFactory");
  const communityFactory = await CommunityFactory.deploy(committee.address);
  await communityFactory.deployed();
  console.log("CommunityFactory:", communityFactory.address);

  const ERC20StakingFactory = await ethers.getContractFactory(
    "ERC20StakingFactory"
  );
  const erc20StakingFactory = await ERC20StakingFactory.deploy(
    communityFactory.address
  );
  await erc20StakingFactory.deployed();
  console.log("ERC20StakingFactory:", erc20StakingFactory.address);

  const ERC20LockingFactory = await ethers.getContractFactory(
    "ERC20LockingFactory"
  );
  const erc20LockingFactory = await ERC20LockingFactory.deploy(
    communityFactory.address
  );
  await erc20LockingFactory.deployed();
  console.log("ERC20LockingFactory:", erc20LockingFactory.address);

  const ERC1155StakingFactory = await ethers.getContractFactory(
    "ERC1155StakingFactory"
  );
  const erc1155StakingFactory = await ERC1155StakingFactory.deploy(
    communityFactory.address
  );
  await erc1155StakingFactory.deployed();
  console.log("ERC1155StakingFactory:", erc1155StakingFactory.address);

  const SPStakingFactory = await ethers.getContractFactory("SPStakingFactory");
  const spStakingFactory = await SPStakingFactory.deploy(
    communityFactory.address
  );
  await spStakingFactory.deployed();
  console.log("SPStakingFactory:", spStakingFactory.address);

  const SocialCurationFactory = await ethers.getContractFactory(
    "SocialCurationFactory"
  );
  const socialCurationFactory = await SocialCurationFactory.deploy(
    communityFactory.address,
    claimSignerAddr
  );
  await socialCurationFactory.deployed();
  console.log("SocialCurationFactory:", socialCurationFactory.address);

  const LinearCalculator = await ethers.getContractFactory("LinearCalculator");
  const linearCalculator = await LinearCalculator.deploy(
    communityFactory.address
  );
  await linearCalculator.deployed();
  console.log("LinearCalculator:", linearCalculator.address);

  const LinearTimeCalculator = await ethers.getContractFactory(
    "LinearTimeCalculator"
  );
  const linearTimeCalculator = await LinearTimeCalculator.deploy(
    communityFactory.address
  );
  await linearTimeCalculator.deployed();
  console.log("LinearTimeCalculator:", linearTimeCalculator.address);

  // Committee 白名单：创建社区 / 加池 会校验
  const whitelistTxs = [
    committee.adminAddContract(mintableERC20Factory.address),
    committee.adminAddContract(linearCalculator.address),
    committee.adminAddContract(linearTimeCalculator.address),
    committee.adminAddContract(erc20StakingFactory.address),
    committee.adminAddContract(erc20LockingFactory.address),
    committee.adminAddContract(erc1155StakingFactory.address),
    committee.adminAddContract(spStakingFactory.address),
    committee.adminAddContract(socialCurationFactory.address),
  ];
  for (const tx of whitelistTxs) {
    await (await tx).wait();
  }
  console.log(
    "Committee whitelist: factories + LinearCalculator + LinearTimeCalculator registered."
  );

  const chainId =
    network.config.chainId !== undefined
      ? network.config.chainId
      : (await ethers.provider.getNetwork()).chainId;

  const out = {
    network: network.name,
    chainId: chainId.toString(),
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    feeRecipient,
    socialCurationClaimSigner: claimSignerAddr,
    Committee: committee.address,
    MintableERC20Factory: mintableERC20Factory.address,
    CommunityFactory: communityFactory.address,
    ERC20StakingFactory: erc20StakingFactory.address,
    ERC20LockingFactory: erc20LockingFactory.address,
    ERC1155StakingFactory: erc1155StakingFactory.address,
    SPStakingFactory: spStakingFactory.address,
    SocialCurationFactory: socialCurationFactory.address,
    LinearCalculator: linearCalculator.address,
    LinearTimeCalculator: linearTimeCalculator.address,
  };

  const dir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const file = path.join(dir, `${network.name}.json`);
  fs.writeFileSync(file, JSON.stringify(out, null, 2), "utf8");
  console.log("Wrote", file);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
