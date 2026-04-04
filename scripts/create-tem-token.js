/**
 * 通过 MintableERC20Factory.createCommunityToken 创建 name/symbol 均为 TEM 的代币。
 *
 * 用法:
 *   MINTABLE_FACTORY=0x... npx hardhat run scripts/create-tem-token.js --network bsc
 *
 * 可选:
 *   INITIAL_SUPPLY_HUMAN=1000000   （人类可读整数，18 位小数，默认 1000000）
 *   TOKEN_OWNER=0x...             （初始供应量接收地址，默认部署账户）
 *
 * 未设置 MINTABLE_FACTORY 时，尝试从 ignition/deployments/chain-<id>/deployed_addresses.json
 * 读取 NutboxProtocol#MintableERC20Factory。
 */
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const NAME = "TEM";
const SYMBOL = "TEM";

function encodeCreateTokenMeta(name, symbol, supplyWei, ownerAddress) {
  const { ethers } = hre;
  const nameBuf = Buffer.from(name, "utf8");
  const symBuf = Buffer.from(symbol, "utf8");
  return (
    "0x" +
    ethers.zeroPadValue(ethers.toBeHex(nameBuf.length), 1).substring(2) +
    nameBuf.toString("hex") +
    ethers.zeroPadValue(ethers.toBeHex(symBuf.length), 1).substring(2) +
    symBuf.toString("hex") +
    ethers.zeroPadValue(ethers.toBeHex(supplyWei), 32).substring(2) +
    ownerAddress.replace(/^0x/i, "").toLowerCase()
  );
}

function readMintableFactoryFromIgnition(chainIdDec) {
  const file = path.join(
    __dirname,
    "..",
    "ignition",
    "deployments",
    `chain-${chainIdDec}`,
    "deployed_addresses.json"
  );
  if (!fs.existsSync(file)) return null;
  const j = JSON.parse(fs.readFileSync(file, "utf8"));
  return j["NutboxProtocol#MintableERC20Factory"] || null;
}

async function main() {
  const { ethers, network } = hre;
  const [deployer] = await ethers.getSigners();

  let factoryAddr = process.env.MINTABLE_FACTORY?.trim();
  const chainId =
    network.config.chainId !== undefined
      ? Number(network.config.chainId)
      : Number((await ethers.provider.getNetwork()).chainId);

  if (!factoryAddr) {
    factoryAddr = readMintableFactoryFromIgnition(chainId);
  }

  if (!factoryAddr || !ethers.isAddress(factoryAddr)) {
    throw new Error(
      "请设置 MINTABLE_FACTORY=0x...，或先完成 Ignition 部署"
    );
  }

  const supplyHuman = process.env.INITIAL_SUPPLY_HUMAN || "1000000";
  const supplyWei = ethers.parseUnits(supplyHuman, 18);

  const ownerRaw = process.env.TOKEN_OWNER?.trim();
  const owner = ownerRaw && ethers.isAddress(ownerRaw) ? ownerRaw : deployer.address;

  const meta = encodeCreateTokenMeta(NAME, SYMBOL, supplyWei, owner);
  const factory = await ethers.getContractAt("MintableERC20Factory", factoryAddr);

  console.log("Network:", network.name, "chainId:", chainId);
  console.log("MintableERC20Factory:", factoryAddr);
  console.log("Name / Symbol:", NAME, "/", SYMBOL);
  console.log("Initial supply (wei):", supplyWei.toString(), "→ owner:", owner);

  const tx = await factory.createCommunityToken(meta);
  const receipt = await tx.wait();

  let tokenAddr;
  const iface = factory.interface;
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed && parsed.name === "CommunityTokenCreated") {
        tokenAddr = parsed.args.token;
        break;
      }
    } catch {
      // ignore
    }
  }

  if (!tokenAddr) {
    throw new Error("未从回执中解析到代币地址；请检查 MintableERC20Factory 是否发出预期事件");
  }

  console.log("Tx:", receipt.hash);
  console.log("MintableERC20 (TEM) address:", tokenAddr);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
