/**
 * 协议全量部署（Hardhat 脚本，与 Ignition 行为对齐）
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
 * 推荐主网使用 Ignition（带 --verify）:
 *   npm run deploy:bsc
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

  if (!ethers.isAddress(feeRecipient)) {
    throw new Error("Invalid FEE_RECIPIENT");
  }
  if (!ethers.isAddress(claimSignerAddr)) {
    throw new Error("Invalid SOCIAL_CURATION_CLAIM_SIGNER");
  }

  console.log("Network:", network.name, "chainId:", network.config.chainId);
  console.log("Deployer:", deployer.address);
  console.log("Fee recipient:", feeRecipient);
  console.log("SocialCuration claim signer:", claimSignerAddr);

  const Committee = await ethers.getContractFactory("Committee");
  const committee = await Committee.deploy(feeRecipient);
  await committee.waitForDeployment();
  console.log("Committee:", await committee.getAddress());

  const MintableERC20Factory = await ethers.getContractFactory(
    "MintableERC20Factory"
  );
  const mintableERC20Factory = await MintableERC20Factory.deploy();
  await mintableERC20Factory.waitForDeployment();
  console.log(
    "MintableERC20Factory:",
    await mintableERC20Factory.getAddress()
  );

  const CommunityFactory = await ethers.getContractFactory("CommunityFactory");
  const communityFactory = await CommunityFactory.deploy(
    await committee.getAddress()
  );
  await communityFactory.waitForDeployment();
  console.log("CommunityFactory:", await communityFactory.getAddress());

  const cf = await communityFactory.getAddress();

  const ERC20StakingFactory = await ethers.getContractFactory(
    "ERC20StakingFactory"
  );
  const erc20StakingFactory = await ERC20StakingFactory.deploy(cf);
  await erc20StakingFactory.waitForDeployment();
  console.log(
    "ERC20StakingFactory:",
    await erc20StakingFactory.getAddress()
  );

  const ERC20LockingFactory = await ethers.getContractFactory(
    "ERC20LockingFactory"
  );
  const erc20LockingFactory = await ERC20LockingFactory.deploy(cf);
  await erc20LockingFactory.waitForDeployment();
  console.log(
    "ERC20LockingFactory:",
    await erc20LockingFactory.getAddress()
  );

  const ERC1155StakingFactory = await ethers.getContractFactory(
    "ERC1155StakingFactory"
  );
  const erc1155StakingFactory = await ERC1155StakingFactory.deploy(cf);
  await erc1155StakingFactory.waitForDeployment();
  console.log(
    "ERC1155StakingFactory:",
    await erc1155StakingFactory.getAddress()
  );

  const SPStakingFactory = await ethers.getContractFactory("SPStakingFactory");
  const spStakingFactory = await SPStakingFactory.deploy(cf);
  await spStakingFactory.waitForDeployment();
  console.log("SPStakingFactory:", await spStakingFactory.getAddress());

  const SocialCurationFactory = await ethers.getContractFactory(
    "SocialCurationFactory"
  );
  const socialCurationFactory = await SocialCurationFactory.deploy(
    cf,
    claimSignerAddr
  );
  await socialCurationFactory.waitForDeployment();
  console.log(
    "SocialCurationFactory:",
    await socialCurationFactory.getAddress()
  );

  const LinearCalculator = await ethers.getContractFactory("LinearCalculator");
  const linearCalculator = await LinearCalculator.deploy(cf);
  await linearCalculator.waitForDeployment();
  console.log("LinearCalculator:", await linearCalculator.getAddress());

  const LinearTimeCalculator = await ethers.getContractFactory(
    "LinearTimeCalculator"
  );
  const linearTimeCalculator = await LinearTimeCalculator.deploy(cf);
  await linearTimeCalculator.waitForDeployment();
  console.log(
    "LinearTimeCalculator:",
    await linearTimeCalculator.getAddress()
  );

  const whitelistTxs = [
    committee.adminAddContract(await mintableERC20Factory.getAddress()),
    committee.adminAddContract(await linearCalculator.getAddress()),
    committee.adminAddContract(await linearTimeCalculator.getAddress()),
    committee.adminAddContract(await erc20StakingFactory.getAddress()),
    committee.adminAddContract(await erc20LockingFactory.getAddress()),
    committee.adminAddContract(await erc1155StakingFactory.getAddress()),
    committee.adminAddContract(await spStakingFactory.getAddress()),
    committee.adminAddContract(await socialCurationFactory.getAddress()),
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
    Committee: await committee.getAddress(),
    MintableERC20Factory: await mintableERC20Factory.getAddress(),
    CommunityFactory: await communityFactory.getAddress(),
    ERC20StakingFactory: await erc20StakingFactory.getAddress(),
    ERC20LockingFactory: await erc20LockingFactory.getAddress(),
    ERC1155StakingFactory: await erc1155StakingFactory.getAddress(),
    SPStakingFactory: await spStakingFactory.getAddress(),
    SocialCurationFactory: await socialCurationFactory.getAddress(),
    LinearCalculator: await linearCalculator.getAddress(),
    LinearTimeCalculator: await linearTimeCalculator.getAddress(),
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
