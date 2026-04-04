/**
 * 读取 CommunityFactory 部署的 Community 实现合约地址（克隆模板 / implementation）。
 *
 * 用法:
 *   COMMUNITY_FACTORY=0x... npx hardhat run scripts/get-community-template.js --network bsc
 *
 * 未设置 COMMUNITY_FACTORY 时，若存在 ignition/deployments/chain-<chainId>/deployed_addresses.json
 * 且含 NutboxProtocol#CommunityFactory，则自动使用该地址。
 */
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

function readFactoryFromIgnitionDeployments(chainIdDec) {
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
  return j["NutboxProtocol#CommunityFactory"] || null;
}

async function main() {
  const { ethers, network } = hre;
  let factoryAddr = process.env.COMMUNITY_FACTORY?.trim();
  const chainId =
    network.config.chainId !== undefined
      ? Number(network.config.chainId)
      : Number((await ethers.provider.getNetwork()).chainId);

  if (!factoryAddr) {
    factoryAddr = readFactoryFromIgnitionDeployments(chainId);
  }

  if (!factoryAddr || !ethers.isAddress(factoryAddr)) {
    throw new Error(
      "请设置环境变量 COMMUNITY_FACTORY=0x...，或先完成 Ignition 部署以生成 ignition/deployments/chain-*"
    );
  }

  const cf = await ethers.getContractAt("CommunityFactory", factoryAddr);
  const template = await cf.communityTemplate();

  console.log("Network:", network.name, "chainId:", chainId);
  console.log("CommunityFactory:", factoryAddr);
  console.log("Community template (implementation for clones):", template);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
