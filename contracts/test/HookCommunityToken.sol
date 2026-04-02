// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev Called when Community pays rewards via `transfer` (non-mintable path).
interface IRewardHook {
    function onRewardDelivery() external;
}

/**
 * @dev Fixed-supply ERC20 that invokes a hook on the recipient when `Community` transfers rewards.
 *      Simulates malicious / fee-on-transfer style callbacks to test reentrancy during withdrawPoolsRewards.
 */
contract HookCommunityToken is ERC20 {
    address public hookCommunity;
    bool public hookArmed;
    bool private _hooking;

    constructor(uint256 supply) ERC20("Hook Community Token", "HCT") {
        _mint(msg.sender, supply);
    }

    function setHookCommunity(address c) external {
        require(hookCommunity == address(0) && c != address(0), "HCT: community");
        hookCommunity = c;
    }

    function setHookArmed(bool v) external {
        hookArmed = v;
    }

    function transfer(address to, uint256 amount) public override returns (bool) {
        bool ok = super.transfer(to, amount);
        _maybeHook(to);
        return ok;
    }

    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        // Pool stakes use transferFrom(user, pool, …) with msg.sender = pool — never hook here.
        return super.transferFrom(from, to, amount);
    }

    function _maybeHook(address to) private {
        if (!hookArmed || _hooking || hookCommunity == address(0)) return;
        if (msg.sender != hookCommunity) return;
        if (to.code.length == 0) return;
        _hooking = true;
        try IRewardHook(to).onRewardDelivery() {} catch {}
        _hooking = false;
    }
}
