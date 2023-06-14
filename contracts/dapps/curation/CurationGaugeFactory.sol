// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;
pragma experimental ABIEncoderV2;

import "solidity-bytes-utils/contracts/BytesLib.sol";
import "../../interfaces/IPoolFactory.sol";
import "./CurationGauge.sol";
import "../../CommunityFactory.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @dev Factory contract of curation pool factory.
 */
contract CurationGaugeFactory is IPoolFactory, Ownable {
    using BytesLib for bytes;
    address public immutable communityFactory;

    // community contract => pool address   
    mapping(address => address) createdCuraionOfCommunity;

    constructor(address _communityFactory) {
        require(_communityFactory != address(0), "Invalid address");
        communityFactory = _communityFactory;
    }

    event CurationGaugeCreated(
        address indexed pool,
        address indexed community,
        string name,
        address indexed recipient
    );

    function createPool(address community, string memory name, bytes calldata meta) override external returns(address) {
        require(community == msg.sender, 'Permission denied: caller is not community');
        require(CommunityFactory(communityFactory).createdCommunity(community), "Invalid community");
        require(createdCuraionOfCommunity[community] == address(0), "Curation gauge has deployed for this community");
        bytes memory recipientBytes = meta.slice(0, 20);
        bytes20 recipient;
        assembly {
            recipient := mload(add(recipientBytes, 0x20))
        }
        CurationGauge pool = new CurationGauge(community, name, address(recipient));
        createdCuraionOfCommunity[community] = address(pool);
        emit CurationGaugeCreated(address(pool), community, name, address(recipient));
        return address(pool);
    }
}
