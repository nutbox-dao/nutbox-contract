// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Point is Ownable, AccessControlEnumerable, ERC20Burnable {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    // address => hasWhitelisted
    mapping (address => bool) public whiteList;
    bool public transferOpened;

    event SetWhiteList(address indexed contractAddress);
    event RemoveWhiteList(address indexed contractAddress);
    event EnableTransfer();
    event DisableTransfer();

    /**
     * @dev Grants `DEFAULT_ADMIN_ROLE`, `MINTER_ROLE` and `PAUSER_ROLE` to the
     * account that deploys the contract.
     *
     * See {ERC20-constructor}.
     */
    constructor(
        string memory name, 
        string memory symbol, 
        uint256 initialSupply,
        address owner
    ) ERC20(name, symbol) {
        require(owner != address(0), "Receive address cant be 0");
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setupRole(MINTER_ROLE, _msgSender());
        _mint(owner, initialSupply);
    }

    /**
     * @dev Creates `amount` new tokens for `to`.
     *
     * See {ERC20-_mint}.
     *
     * Requirements:
     *
     * - the caller must have the `MINTER_ROLE`.
     */
    function mint(address to, uint256 amount) external virtual {
        require(hasRole(MINTER_ROLE, _msgSender()), "ERC20PresetMinterPauser: must have minter role to mint");
        _mint(to, amount);
    }

    function setWhiteList(address _contract) external onlyOwner {
        require(_contract != address(0), 'Invalid contract address');
        whiteList[_contract] = true;
        emit SetWhiteList(_contract);
    }

    function removeWhiteList(address _contract) external onlyOwner {
        require(_contract != address(0), 'Invalid contract address');
        whiteList[_contract] = false;
        emit RemoveWhiteList(_contract);
    }

    function enableTransfer() external onlyOwner {
        transferOpened = true;
        emit EnableTransfer();
    }

    function disableTransfer() external onlyOwner {
        transferOpened = false;
        emit DisableTransfer();
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override(ERC20) {
        super._beforeTokenTransfer(from, to, amount);
    }

    function _transfer(address sender, address recipient, uint256 amount) internal virtual override {
        if (!transferOpened && msg.sender != owner())
            require(whiteList[recipient] || whiteList[sender], 'Permission denied: sender or recipient is not white list');
        super._transfer(sender, recipient, amount);
    }
}