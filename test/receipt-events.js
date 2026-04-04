/**
 * Ethers v6：从 TransactionReceipt.logs 解析事件（替代旧版 receipt.events.find）
 */
function findEvent(receipt, iface, eventName) {
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed && parsed.name === eventName) return parsed;
    } catch {
      // 非本合约 / 无法解析
    }
  }
  return undefined;
}

module.exports = { findEvent };
