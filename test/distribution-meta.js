const { ethers } = require("hardhat");

/** 32 字节十六进制片段（无 0x 前缀），与旧 hexZeroPad(...,32).substring(2) 一致 */
function u256Hex(n) {
  return ethers.zeroPadValue(ethers.toBeHex(BigInt(n)), 32).substring(2);
}

/** parseUnits 得到的 amount（bigint）编码为 32 字节 hex 片段 */
function amountHex(amountWei) {
  return ethers.zeroPadValue(ethers.toBeHex(amountWei), 32).substring(2);
}

/**
 * 将多段 distribution 编码为 createCommunity 所需的 bytes（与链上解码一致）
 * @param {{ startHeight: number, stopHeight: number, amount: number }[]} segments amount 为「人类可读整数」，按 18 位小数编码
 */
function encodeLinearDistribution(segments) {
  let s =
    "0x" +
    ethers.zeroPadValue(ethers.toBeHex(segments.length), 1).substring(2);
  for (const dis of segments) {
    s += u256Hex(dis.startHeight);
    s += u256Hex(dis.stopHeight);
    s += amountHex(ethers.parseUnits(String(dis.amount), 18));
  }
  return s;
}

module.exports = { u256Hex, amountHex, encodeLinearDistribution };
