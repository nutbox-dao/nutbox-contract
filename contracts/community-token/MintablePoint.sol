// SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

/**
 *  This contract is designed for non-transfer point
 *  It can only be mint from community contract with a unmutable distribution
 *  We can change the senders at the first
 *  And will renouce the right after set up all the senders
 */
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/Context.sol";

contract MintablePoint is Context, AccessControlEnumerable, ERC20Burnable {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    address public transferModifier;
    mapping(address => bool) senders;
    bool canChangeSender = true;

    event ChangeSender(address indexed sender, bool indexed canSend);

    constructor(
    address _transferModifier,
    string memory name, 
    string memory symbol, 
    uint256 initialSupply,
    address owner,
    address communityFactory) ERC20(name, symbol) {
        transferModifier = _transferModifier;
        _setupRole(DEFAULT_ADMIN_ROLE, communityFactory);
        _mint(owner, initialSupply);
    }

    function renounceModifyRole() external {
        require(transferModifier == msg.sender, "You are not the modifier");
        canChangeSender = false;
    }

    function setSender(address sender, bool canSend) external {
        require(transferModifier == msg.sender, "You can't set sender.");
        require(canChangeSender, "Can't change senders forever");
        senders[sender] = canSend;
        emit ChangeSender(sender, canSend);
    }

    function mint(address to, uint256 amount) external virtual {
        require(hasRole(MINTER_ROLE, _msgSender()), "ERC20PresetMinterPauser: must have minter role to mint");
        _mint(to, amount);
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override(ERC20) {
        super._beforeTokenTransfer(from, to, amount);
        if (!hasRole(MINTER_ROLE, _msgSender()) && from != address(0)) {
            require(senders[from], "You has no right to send point");
        }
    }
}