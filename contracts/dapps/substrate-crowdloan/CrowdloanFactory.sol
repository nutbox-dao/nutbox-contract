// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;
pragma experimental ABIEncoderV2;

import "../../interfaces/IPoolFactory.sol";
import "./Crowdloan.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "solidity-bytes-utils/contracts/BytesLib.sol";
import "../../CommunityFactory.sol";

/**
 * @dev Factory contract of Nutbox Crowdloan contribute pool.
 *x
 */
contract CrowdloanFactory is IPoolFactory, Ownable {
    using BytesLib for bytes;
    mapping (uint8 => mapping(address => bool)) public isBridge;
    address public immutable communityFactory;

    constructor(address _communityFactory) {
        require(_communityFactory != address(0), "Invalid address");
        communityFactory = _communityFactory;
    }

    event CrowdloanCreated(
        address indexed pool,
        address indexed community,
        string name,
        uint8 chainId,
        uint256 paraId,
        uint256 fundIndex
    );

    event AdminSetBridge(uint8 indexed chainId, address indexed bridge, bool flag);

    function createPool(address community, string memory name, bytes calldata meta) override external returns(address) {
        require(community == msg.sender, 'Permission denied: caller is not community');
        require(CommunityFactory(communityFactory).createdCommunity(community), "Invalid community");
        uint8 chainId = meta.toUint8(0);
        uint256 paraId = meta.toUint256(1);
        uint256 fundIndex = meta.toUint256(33);
        Crowdloan pool = new Crowdloan(community, name, chainId, paraId, fundIndex);
        emit CrowdloanCreated(address(pool), community, name, chainId, paraId, fundIndex);
        return address(pool);
    }

    function adminSetBridge(uint8 _chainId, address _bridge, bool _flag) external onlyOwner {
        require(_bridge != address(0), "Invalid address");
        isBridge[_chainId][_bridge] = _flag;
        emit AdminSetBridge(_chainId, _bridge, _flag);
    }
}
