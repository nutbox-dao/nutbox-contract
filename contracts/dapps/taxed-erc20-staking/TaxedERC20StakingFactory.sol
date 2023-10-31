// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;
pragma experimental ABIEncoderV2;

import "solidity-bytes-utils/contracts/BytesLib.sol";
import "../../interfaces/IPoolFactory.sol";
import "./TaxedERC20Staking.sol";
import "../../CommunityFactory.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @dev Factory contract of Nutbox taxed ERC20 staking pool.
 *x
 */
contract TaxedERC20StakingFactory is IPoolFactory, Ownable {
    using BytesLib for bytes;
    address public immutable communityFactory;

    uint256 public communityTax = 200;
    uint256 public nutboxTax = 50;

    constructor(address _communityFactory) {
        require(_communityFactory != address(0), "Invalid address");
        communityFactory = _communityFactory;
    }

    event TaxedERC20StakingCreated(
        address indexed pool,
        address indexed community,
        string name,
        address erc20Token
    );

    function adminSetCommunityTax(uint256 _tax) public onlyOwner {
        communityTax = _tax;
    }

    function adminSetNutboxTax(uint256 _tax) public onlyOwner {
        nutboxTax = _tax;
    }

    function nutboxTreasury() public view returns (address) {
        return owner();
    }

    function createPool(address community, string memory name, bytes calldata meta) override external returns(address) {
        require(community == msg.sender, 'Permission denied: caller is not community');
        require(CommunityFactory(communityFactory).createdCommunity(community), "Invalid community");
        bytes memory stakeTokenBytes = meta.slice(0, 20);
        bytes20 stakeToken;
        assembly {
            stakeToken := mload(add(stakeTokenBytes, 0x20))
        }
        TaxedERC20Staking pool = new TaxedERC20Staking(community, name, address(stakeToken));
        emit TaxedERC20StakingCreated(address(pool), community, name, address(stakeToken));
        return address(pool);
    }
}
