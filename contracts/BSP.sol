// SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract BSP is Ownable, AccessControlEnumerable, ERC20Burnable {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    event SteemToBSP(
        string steemAccount,
        address indexed to,
        uint256 indexed amount
    );
    event BSPToSteem(
        string steemAccount,
        address indexed to,
        uint256 indexed amount
    );

    constructor() ERC20("BSC STEEP POWER", "BSP") {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setupRole(MINTER_ROLE, _msgSender());

        // _name = "BSC STEEP POWER";
        // _symbol = "BSP";
    }

    function steemToBsp(
        string memory steem,
        address to,
        uint256 amount
    ) public {
        // require(hasRole(MINTER_ROLE, _msgSender()), "ERC20PresetMinterPauser: must have minter role to mint");
        require(to != address(0), "Wrong target address");
        _mint(to, amount);
        emit SteemToBSP(steem, to, amount);
    }

    function bspToSteem(string memory steem, uint256 amount) public {
        burn(amount);
        emit BSPToSteem(steem, msg.sender, amount);
    }
}
