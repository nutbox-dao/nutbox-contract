//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC1155/presets/ERC1155PresetMinterPauser.sol";

contract ERC1155NFT is ERC1155PresetMinterPauser {
    constructor(string memory uri_) ERC1155PresetMinterPauser(uri_){}

    function setURI(string memory newuri)public onlyRole(getRoleAdmin(DEFAULT_ADMIN_ROLE)){
        _setURI(newuri);
    }
}