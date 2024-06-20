// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;
pragma experimental ABIEncoderV2;

import "../../interfaces/IPoolFactory.sol";
import "./SPStaking.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "solidity-bytes-utils/contracts/BytesLib.sol";
import "../../CommunityFactory.sol";

/**
 * @dev Factory contract of Nutbox ERC20 staking pool.
 *x
 */
contract SPStakingFactory is IPoolFactory, Ownable {
    using BytesLib for bytes;
    address public bridge;
    address public immutable communityFactory;
    uint256 private transFee = 0.00001 ether;

    constructor(address _communityFactory) {
        require(_communityFactory != address(0), "Invalid address");
        communityFactory = _communityFactory;
    }

    event SPStakingCreated(
        address indexed pool,
        address indexed community,
        string name,
        uint8 chainId,
        bytes32 delegatee
    );

    event BridgeChange(address indexed oldBridge, address indexed newBridge);

    function getFeeInfo() public override view returns (address, uint256) {
        return (owner(), transFee);
    }

    function updateFee(uint256 _transFee) public onlyOwner() {
        transFee = _transFee;
    }

    function createPool(address community, string memory name, bytes calldata meta) override external returns(address) {
        require(community == msg.sender, 'Permission denied: caller is not community');
        require(CommunityFactory(communityFactory).createdCommunity(community), "Invalid community");
        uint8 chainId = meta.toUint8(0);
        bytes32 delegatee = meta.toBytes32(1);
        SPStaking pool = new SPStaking(community, name, chainId, delegatee);
        emit SPStakingCreated(address(pool), community, name, chainId, delegatee);
        return address(pool);
    }

    function adminSetBridge(address _bridge) external onlyOwner {
        require(_bridge != address(0), "Invalid address");
        emit BridgeChange(bridge, _bridge);
        bridge = _bridge;
    }
}
