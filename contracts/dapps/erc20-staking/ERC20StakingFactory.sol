// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;
pragma experimental ABIEncoderV2;

import "solidity-bytes-utils/contracts/BytesLib.sol";
import "../../interfaces/IPoolFactory.sol";
import "./ERC20Staking.sol";
import "../../CommunityFactory.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @dev Factory contract of Nutbox ERC20 staking pool.
 *x
 */
contract ERC20StakingFactory is IPoolFactory, Ownable {
    using BytesLib for bytes;
    address public immutable communityFactory;
    uint256 private transFee = 0.00001 ether;

    constructor(address _communityFactory) {
        require(_communityFactory != address(0), "Invalid address");
        communityFactory = _communityFactory;
    }

    event ERC20StakingCreated(
        address indexed pool,
        address indexed community,
        string name,
        address erc20Token
    );
    
    function getFeeInfo() public override view returns (address, uint256) {
        return (owner(), transFee);
    }

    function updateFee(uint256 _transFee) public onlyOwner() {
        transFee = _transFee;
    }

    function createPool(address community, string memory name, bytes calldata meta) override external returns(address) {
        require(community == msg.sender, 'Permission denied: caller is not community');
        require(CommunityFactory(communityFactory).createdCommunity(community), "Invalid community");
        bytes memory stakeTokenBytes = meta.slice(0, 20);
        bytes20 stakeToken;
        assembly {
            stakeToken := mload(add(stakeTokenBytes, 0x20))
        }
        ERC20Staking pool = new ERC20Staking(community, name, address(stakeToken));
        emit ERC20StakingCreated(address(pool), community, name, address(stakeToken));
        return address(pool);
    }
}
