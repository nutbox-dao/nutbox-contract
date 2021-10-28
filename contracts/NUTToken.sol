// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";


contract NUTToken is Ownable, AccessControlEnumerable, ERC20Burnable, ERC20Pausable {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    // address => hasWhitelisted
    mapping (address => bool) public whiteList;
    bool public transferOpened = false;

    event SetWhiteList(address indexed contractAddress);
    event RemoveWhiteList(address indexed contractAddress);

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
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setupRole(MINTER_ROLE, _msgSender());
        _setupRole(PAUSER_ROLE, _msgSender());
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
    }

    function disableTransfer() external onlyOwner {
        transferOpened = false;
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override(ERC20, ERC20Pausable) {
        super._beforeTokenTransfer(from, to, amount);
    }

    function _transfer(address sender, address recipient, uint256 amount) internal virtual override {
        // before NUT enable transfer to public, only owner can make  transfer(for airdrop),
        // other NUT holders can only transfer to whitlisted recipient(join staking etc.)
        if (!transferOpened && msg.sender != owner())
            require(whiteList[recipient] || whiteList[sender], 'Permission denied: sender or recipient is not white list');
        super._transfer(sender, recipient, amount);
    }
}
