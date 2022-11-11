//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/token/ERC721/presets/ERC721PresetMinterPauserAutoId.sol";

contract Tradable721 is ERC721PresetMinterPauserAutoId {
    using Strings for uint256;

    bytes32 public constant BURN_ROLE = keccak256("BURN_ROLE");
    bytes32 public constant URLSETTER_ROLE = keccak256("URLSETTER_ROLE");

    string private _baseTokenURI;

    constructor(string memory name, string memory symbol) ERC721PresetMinterPauserAutoId(name, symbol, "") {
        _setupRole(BURN_ROLE, _msgSender());
        _setupRole(URLSETTER_ROLE, _msgSender());
    }

    function adminBurn(uint256 id) public {
        require(hasRole(BURN_ROLE, _msgSender()), "Must have burn role to burn");
        _burn(id);
    }

    function _baseURI() internal view virtual override returns (string memory) {
        return _baseTokenURI;
    }

    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        require(_exists(tokenId), "ERC721Metadata: URI query for nonexistent token");

        string memory baseURI = _baseURI();
        return bytes(baseURI).length > 0 ? string(abi.encodePacked(baseURI, tokenId.toString(), ".json")) : "";
    }

    function setBaseURI(string memory uri) public virtual {
        require(hasRole(URLSETTER_ROLE, _msgSender()), "Must have URLSETTER_ROLE role to set uri");
        _baseTokenURI = uri;
    }
}
