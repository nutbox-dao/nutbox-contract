// SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/Context.sol";

/**
 * @dev {ERC20} token, including:
 *
 *  - Preminted initial supply
 *  - Ability for holders to burn (destroy) their tokens
 *  - No access control mechanism (for minting/pausing) and hence no governance
 *
 * This contract uses {ERC20Burnable} to include burn capabilities - head to
 * its documentation for details.
 *
 * _Available since v3.4._
 */
contract Point is Context, AccessControlEnumerable, ERC20Burnable {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant TRANSFER_ROLE = keccak256("TRANSFER_ROLE");
    bytes32 public constant TRANSFER_ROLE_ADMIN = keccak256("TRANSFER_ROLE_ADMIN");

    uint256 public startTradableTime;

    /**
     * @dev Grants `DEFAULT_ADMIN_ROLE` to the
     * community factory contract,
     * then community factory will grant mint role to the community.
     *
     * See {ERC20-constructor}.
     */
    constructor(string memory name, 
    string memory symbol, 
    uint256 _startTradableTime,
    uint256 initialSupply,
    address owner,
    address communityFactory) ERC20(name, symbol) {
        startTradableTime = _startTradableTime;
        _setRoleAdmin(TRANSFER_ROLE, TRANSFER_ROLE_ADMIN);
        _setupRole(DEFAULT_ADMIN_ROLE, communityFactory);
        _setupRole(TRANSFER_ROLE_ADMIN, owner);
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

    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == bytes4(keccak256('DelayTransactionPoint'))
                || super.supportsInterface(interfaceId);
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override(ERC20) {
        if (from != address(0) && to != address(0) && !hasRole(TRANSFER_ROLE, from) && !hasRole(TRANSFER_ROLE, to)) {
            // can mint or burn point
            require(block.timestamp > startTradableTime, "Token can't tradable right now");
        }
        super._beforeTokenTransfer(from, to, amount);
    }
}