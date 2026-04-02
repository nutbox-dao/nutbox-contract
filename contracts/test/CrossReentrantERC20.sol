// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

interface ICommunityReenter {
    function withdrawPoolsRewards(address[] memory pools) external payable;
    function getUserDebt(address pool, address user) external view returns (uint256);
}

/**
 * @dev Malicious ERC20 that attempts cross-contract reentrancy during transfer.
 *      Used to verify that Checks-Effects-Interactions prevents double claim of rewards.
 */
contract CrossReentrantERC20 is ERC20 {
    address public community;
    address public poolAddr;
    bool public armed;
    bool private _reentering;
    bool public reentryAttempted;
    uint256 public claimCount;

    constructor() ERC20("Evil Cross Token", "EVILX") {
        _mint(msg.sender, 1_000_000 ether);
    }

    function setTargets(address _community, address _pool) external { 
        community = _community; 
        poolAddr = _pool; 
    }

    function arm() external { armed = true; }
    function disarm() external { armed = false; }

    // Override transfer which is called by the pool during withdraw
    function transfer(address to, uint256 amount) public override returns (bool) {
        bool result = super.transfer(to, amount);
        if (armed && community != address(0) && poolAddr != address(0) && !_reentering) {
            _reentering = true;
            reentryAttempted = true;

            address[] memory pools = new address[](1);
            pools[0] = poolAddr;
            
            // Try to reenter Community.withdrawPoolsRewards
            try ICommunityReenter(community).withdrawPoolsRewards{value: 0}(pools) {
                claimCount++;
            } catch {}

            _reentering = false;
        }
        return result;
    }
}
