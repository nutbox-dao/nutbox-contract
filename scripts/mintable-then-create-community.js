/**
 * 1) 通过 MintableERC20Factory 创建可增发代币并解析地址（Transfer from 0x0）
 * 2) 使用该代币地址调用 CommunityFactory.createCommunity
 * 3) 从 CommunityCreated 事件解析社区地址
 * 4) 为社区合约授予代币 MINTER_ROLE（代币在厂外创建时链上不会自动 grant）
 *
 * 用法:
 *   npx hardhat run scripts/mintable-then-create-community.js --network bsc
 *
 * 可选环境变量（未填则从 ignition/deployments/chain-<id>/deployed_addresses.json 读取）:
 *   COMMITTEE, MINTABLE_FACTORY, COMMUNITY_FACTORY, LINEAR_CALCULATOR
 *
 * 代币与分配:
 *   TOKEN_NAME, TOKEN_SYMBOL        默认 TEM / TEM
 *   INITIAL_SUPPLY_HUMAN            默认 1000000（18 位）
 *   TOKEN_OWNER                     默认部署账户
 *   CREATE_COMMUNITY_VALUE_WEI      覆盖发送的 msg.value（默认按 Committee.getCreateCommunityFee()）
 *
 *   SKIP_GRANT_MINTER=1             跳过对社区授予 MINTER_ROLE（一般不要跳）
 */
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");
const { encodeLinearDistribution } = require("../test/distribution-meta");

function readDeployedMap(chainIdDec) {
  const file = path.join(
    __dirname,
    "..",
    "ignition",
    "deployments",
    `chain-${chainIdDec}`,
    "deployed_addresses.json"
  );
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function encodeTokenMeta(name, symbol, supplyWei, ownerAddress) {
  const { ethers } = hre;
  const nb = Buffer.from(name, "utf8");
  const sb = Buffer.from(symbol, "utf8");
  return (
    "0x" +
    ethers.zeroPadValue(ethers.toBeHex(nb.length), 1).substring(2) +
    nb.toString("hex") +
    ethers.zeroPadValue(ethers.toBeHex(sb.length), 1).substring(2) +
    sb.toString("hex") +
    ethers.zeroPadValue(ethers.toBeHex(supplyWei), 32).substring(2) +
    ownerAddress.replace(/^0x/i, "").toLowerCase()
  );
}

/** 从 createCommunityToken 的交易回执中解析新 MintableERC20 地址 */
function parseNewTokenFromReceipt(receipt, factoryAddr) {
  const { ethers } = hre;
  const transferIface = new ethers.Interface([
    "event Transfer(address indexed from, address indexed to, uint256 value)",
  ]);
  const f = factoryAddr.toLowerCase();
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() === f) continue;
    try {
      const p = transferIface.parseLog(log);
      if (p.name === "Transfer" && p.args.from === ethers.ZeroAddress) {
        return log.address;
      }
    } catch {
      // ignore
    }
  }
  return null;
}

async function main() {
  const { ethers, network } = hre;
  const [deployer] = await ethers.getSigners();

  const chainId =
    network.config.chainId !== undefined
      ? Number(network.config.chainId)
      : Number((await ethers.provider.getNetwork()).chainId);

  const map = readDeployedMap(chainId) || {};

  const committee =
    process.env.COMMITTEE?.trim() || map["NutboxProtocol#Committee"];
  const mintableFactory =
    process.env.MINTABLE_FACTORY?.trim() ||
    map["NutboxProtocol#MintableERC20Factory"];
  const communityFactory =
    process.env.COMMUNITY_FACTORY?.trim() ||
    map["NutboxProtocol#CommunityFactory"];
  const linearCalculator =
    process.env.LINEAR_CALCULATOR?.trim() ||
    map["NutboxProtocol#LinearCalculator"];

  for (const [k, v] of Object.entries({
    COMMITTEE: committee,
    MINTABLE_FACTORY: mintableFactory,
    COMMUNITY_FACTORY: communityFactory,
    LINEAR_CALCULATOR: linearCalculator,
  })) {
    if (!v || !ethers.isAddress(v)) {
      throw new Error(
        `缺少 ${k}，请在 .env 设置或确保存在 ignition/deployments/chain-${chainId}/deployed_addresses.json`
      );
    }
  }

  const name = process.env.TOKEN_NAME || "TEM";
  const symbol = process.env.TOKEN_SYMBOL || "TEM";
  const supplyHuman = process.env.INITIAL_SUPPLY_HUMAN || "1000000";
  const supplyWei = ethers.parseUnits(supplyHuman, 18);
  const ownerRaw = process.env.TOKEN_OWNER?.trim();
  const tokenOwner =
    ownerRaw && ethers.isAddress(ownerRaw) ? ownerRaw : deployer.address;

  const meta = encodeTokenMeta(name, symbol, supplyWei, tokenOwner);
  const mFactory = await ethers.getContractAt(
    "MintableERC20Factory",
    mintableFactory
  );

  console.log("Network:", network.name, "chainId:", chainId);
  console.log("Deployer:", deployer.address);
  console.log("Step 1: MintableERC20Factory.createCommunityToken ...");

  const tx1 = await mFactory.createCommunityToken(meta);
  const receipt1 = await tx1.wait();
  const tokenAddr = parseNewTokenFromReceipt(receipt1, mintableFactory);
  if (!tokenAddr) {
    throw new Error("未能从回执解析新代币地址（查找 Transfer from 0）");
  }
  console.log("  Token:", tokenAddr, `(${name} / ${symbol})`);
  console.log("  Tx:", receipt1.hash);

  const committeeC = await ethers.getContractAt("Committee", committee);
  let feeWei = await committeeC.getCreateCommunityFee();
  if (process.env.CREATE_COMMUNITY_VALUE_WEI) {
    feeWei = BigInt(process.env.CREATE_COMMUNITY_VALUE_WEI.trim());
  }

  const bn = await ethers.provider.getBlockNumber();
  const distribution = encodeLinearDistribution([
    { startHeight: bn + 100, stopHeight: bn + 1000, amount: 100 },
    { startHeight: bn + 1001, stopHeight: bn + 2000, amount: 50 },
  ]);

  const cFactory = await ethers.getContractAt(
    "CommunityFactory",
    communityFactory
  );

  console.log("Step 2: CommunityFactory.createCommunity (value:", feeWei.toString(), "wei) ...");

  const tx2 = await cFactory.createCommunity(
    true,
    tokenAddr,
    ethers.ZeroAddress,
    "0x",
    linearCalculator,
    distribution,
    { value: feeWei }
  );
  const receipt2 = await tx2.wait();

  let communityAddr;
  for (const log of receipt2.logs) {
    if (log.address.toLowerCase() !== communityFactory.toLowerCase()) continue;
    try {
      const parsed = cFactory.interface.parseLog(log);
      if (parsed && parsed.name === "CommunityCreated") {
        communityAddr = parsed.args.community;
        break;
      }
    } catch {
      // ignore
    }
  }

  if (!communityAddr) {
    throw new Error("未能从回执解析 CommunityCreated 事件");
  }

  console.log("  Community:", communityAddr);
  console.log("  Tx:", receipt2.hash);

  if (process.env.SKIP_GRANT_MINTER === "1") {
    console.log("Step 3: 跳过 MINTER_ROLE（SKIP_GRANT_MINTER=1）");
  } else {
    console.log("Step 3: MintableERC20.grantRole(MINTER_ROLE, community) ...");
    const token = await ethers.getContractAt("MintableERC20", tokenAddr);
    const role = await token.MINTER_ROLE();
    const tx3 = await token.grantRole(role, communityAddr);
    const receipt3 = await tx3.wait();
    console.log("  Tx:", receipt3.hash);
  }

  console.log("\n汇总:");
  console.log("  communityToken:", tokenAddr);
  console.log("  community:      ", communityAddr);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
