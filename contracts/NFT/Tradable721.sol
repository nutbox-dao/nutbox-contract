//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/token/ERC721/presets/ERC721PresetMinterPauserAutoId.sol";

contract Tradable721 is ERC721PresetMinterPauserAutoId {
    using Strings for uint256;
    using Counters for Counters.Counter;

    bytes32 public constant BURN_ROLE = keccak256("BURN_ROLE");
    bytes32 public constant URLSETTER_ROLE = keccak256("URLSETTER_ROLE");

    string _baseTokenURI;
    Counters.Counter _tokenIdTracker;

    // token id => ipfs cid
    mapping(uint256 => string) public cids;

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
        return bytes(baseURI).length > 0 ? string(abi.encodePacked(baseURI, cids[tokenId])) : "";
    }

    function setBaseURI(string memory uri) public virtual {
        require(hasRole(URLSETTER_ROLE, _msgSender()), "Must have URLSETTER_ROLE role to set uri");
        _baseTokenURI = uri;
    }

    function adminMint(address to, string memory cid) public virtual {
        require(hasRole(MINTER_ROLE, _msgSender()), "ERC721PresetMinterPauserAutoId: must have minter role to mint");
        uint256 id = _tokenIdTracker.current();
        cids[id] = cid;
        _mint(to, id);
        _tokenIdTracker.increment();
    }

    function mint(address to) public virtual override {}
}
