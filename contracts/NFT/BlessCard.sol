//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC1155/presets/ERC1155PresetMinterPauser.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract BlessCard is ERC1155PresetMinterPauser {
    using Strings for uint256;
    bytes32 public constant BURN_ROLE = keccak256("BURN_ROLE");

    constructor(string memory uri_) ERC1155PresetMinterPauser(uri_) {
        _setupRole(BURN_ROLE, _msgSender());
    }

    function burn(
        address account,
        uint256 id,
        uint256 value
    ) public virtual override(ERC1155Burnable) {
        require(account == _msgSender() || isApprovedForAll(account, _msgSender()) || hasRole(BURN_ROLE, _msgSender()), "ERC1155: caller is not owner nor approved");

        _burn(account, id, value);
    }

    function burnBatch(
        address account,
        uint256[] memory ids,
        uint256[] memory values
    ) public virtual override(ERC1155Burnable) {
        require(account == _msgSender() || isApprovedForAll(account, _msgSender()) || hasRole(BURN_ROLE, _msgSender()), "ERC1155: caller is not owner nor approved");

        _burnBatch(account, ids, values);
    }

    function uri(uint256 tokenId) public view virtual override(ERC1155) returns (string memory) {
        string memory base_uri = super.uri(tokenId);
        return string(abi.encodePacked(base_uri, tokenId.toString(), ".json"));
    }
}
