/**
 * Nutbox 协议全量部署（Hardhat Ignition）
 *
 * 与 scripts/deploy-protocol.js 顺序一致，部署后可配合 --verify 在浏览器验证源码。
 *
 * 参数 (--parameters JSON):
 *   - feeRecipient: Committee 构造参数，接收协议 BNB 手续费 (address)
 *   - socialCurationClaimSigner: SocialCurationFactory 链下认领签名者 (address，可选，默认与 feeRecipient 相同)
 *
 * 示例:
 *   npx hardhat ignition deploy ignition/modules/NutboxProtocol.js --network bsc --verify --parameters ignition/parameters/bsc.json
 */

const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("NutboxProtocol", (m) => {
  const feeRecipient = m.getParameter("feeRecipient");
  const socialCurationClaimSigner = m.getParameter(
    "socialCurationClaimSigner",
    feeRecipient
  );

  const committee = m.contract("Committee", [feeRecipient], { id: "Committee" });

  const mintableERC20Factory = m.contract("MintableERC20Factory", [], {
    id: "MintableERC20Factory",
  });

  const communityFactory = m.contract("CommunityFactory", [committee], {
    id: "CommunityFactory",
  });

  const erc20StakingFactory = m.contract(
    "ERC20StakingFactory",
    [communityFactory],
    { id: "ERC20StakingFactory" }
  );

  const erc20LockingFactory = m.contract(
    "ERC20LockingFactory",
    [communityFactory],
    { id: "ERC20LockingFactory" }
  );

  const erc1155StakingFactory = m.contract(
    "ERC1155StakingFactory",
    [communityFactory],
    { id: "ERC1155StakingFactory" }
  );

  const spStakingFactory = m.contract("SPStakingFactory", [communityFactory], {
    id: "SPStakingFactory",
  });

  const socialCurationFactory = m.contract(
    "SocialCurationFactory",
    [communityFactory, socialCurationClaimSigner],
    { id: "SocialCurationFactory" }
  );

  const linearCalculator = m.contract("LinearCalculator", [communityFactory], {
    id: "LinearCalculator",
  });

  const linearTimeCalculator = m.contract(
    "LinearTimeCalculator",
    [communityFactory],
    { id: "LinearTimeCalculator" }
  );

  m.call(committee, "adminAddContract", [mintableERC20Factory], {
    id: "WhitelistMintableERC20Factory",
  });
  m.call(committee, "adminAddContract", [linearCalculator], {
    id: "WhitelistLinearCalculator",
  });
  m.call(committee, "adminAddContract", [linearTimeCalculator], {
    id: "WhitelistLinearTimeCalculator",
  });
  m.call(committee, "adminAddContract", [erc20StakingFactory], {
    id: "WhitelistERC20StakingFactory",
  });
  m.call(committee, "adminAddContract", [erc20LockingFactory], {
    id: "WhitelistERC20LockingFactory",
  });
  m.call(committee, "adminAddContract", [erc1155StakingFactory], {
    id: "WhitelistERC1155StakingFactory",
  });
  m.call(committee, "adminAddContract", [spStakingFactory], {
    id: "WhitelistSPStakingFactory",
  });
  m.call(committee, "adminAddContract", [socialCurationFactory], {
    id: "WhitelistSocialCurationFactory",
  });

  return {
    committee,
    mintableERC20Factory,
    communityFactory,
    erc20StakingFactory,
    erc20LockingFactory,
    erc1155StakingFactory,
    spStakingFactory,
    socialCurationFactory,
    linearCalculator,
    linearTimeCalculator,
  };
});
