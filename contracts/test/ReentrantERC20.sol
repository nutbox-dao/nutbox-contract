// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

interface IPoolReenter {
    function withdraw(uint256 amount) external payable;
}

/**
 * @dev Malicious ERC20 that attempts reentrancy during transferFrom.
 *      Used to verify that pool nonReentrant guards are effective.
 */
contract ReentrantERC20 is ERC20 {
    address public attackTarget;
    bool public armed;
    bool private _reentering;
    bool public reentryAttempted;

    constructor() ERC20("Evil Token", "EVIL") {
        _mint(msg.sender, 1_000_000 ether);
    }

    function setAttackTarget(address t) external { attackTarget = t; }
    function arm() external { armed = true; }
    function disarm() external { armed = false; }

    /// @dev During transferFrom (called by pool.deposit), attempt to reenter pool.withdraw
    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        bool result = super.transferFrom(from, to, amount);
        if (armed && attackTarget != address(0) && !_reentering) {
            _reentering = true;
            reentryAttempted = true;
            try IPoolReenter(attackTarget).withdraw{value: 0}(amount) {} catch {}
            _reentering = false;
        }
        return result;
    }
}
