// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import '@openzeppelin/contracts/access/AccessControl.sol';
import '../MintableERC20.sol';
import '../common/Types.sol';
import './StakingTemplate.sol';
import '../NoDelegateCall.sol';
import './calculators/ICalculator.sol';

/**
 * @dev Factory contract to create an StakingTemplate entity
 *
 * This is the entry contract that user start to create their own staking economy.
 */
contract StakingFactory is NoDelegateCall, AccessControl {

    address public registryHub;
    bytes32 public NUT;
    uint256 public stakedNUT;

    // owner => stakingFeastList
    mapping (address => address[]) public stakingFeastRecord;
    // owner => counter
    mapping (address => uint8) public stakingFeastCounter;

    event StakingFeastCreated(address indexed creater, address stakingFeast, bytes32 rewardAsset);

    modifier onlyAdmin() {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Sender is not admin");
        _;
    }

    constructor(address _registryHub) {
        registryHub = _registryHub;

        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // only owner of reward token can call this method 
    function createStakingFeast (
        bytes32 _rewardAsset,
        address _rewardCalculator,
        bytes calldata policy
    ) public noDelegateCall {
        address tokenAddress = IRegistryHub(registryHub).getHomeLocation(_rewardAsset);
        require(tokenAddress != address(0), 'Reward asset is not registered');

        StakingTemplate feastAddress = new StakingTemplate(registryHub);

        feastAddress.initialize(
            msg.sender,
            _rewardAsset,
            _rewardCalculator
        );

        // set staking feast rewarad distribution policy
        ICalculator(_rewardCalculator).setDistributionEra(address(feastAddress), policy);

        // add feast into whitelist of ERC20AssetHandler
        bytes memory data = abi.encodeWithSignature(
            "setWhitelist(address)",
            address(feastAddress)
        );
        (bool success1,) = IRegistryHub(registryHub).getERC20AssetHandler().call(data);
        require(success1, "failed to call ERC20AssetHandler.setWhitelist");

        // add feast into whitelist of TrustlessAssetHandler
        (bool success2,) = IRegistryHub(registryHub).getTrustlessAssetHandler().call(data);
        require(success2, "failed to call TrustlessAssetHandler.setWhitelist");

        // add feast into whitelist of ERC721AssetHandler
        (bool success3,) = IRegistryHub(registryHub).getERC721AssetHandler().call(data);
        require(success3, "failed to call ERC721AssetHandler.setWhitelist");

        // add feast into whitelist of ERC1155AssetHandler
        (bool success4,) = IRegistryHub(registryHub).getTrustlessAssetHandler().call(data);
        require(success4, "failed to call TrustlessAssetHandler.setWhitelist");

        // save record
        stakingFeastRecord[msg.sender].push(address(feastAddress));
        stakingFeastCounter[msg.sender] = stakingFeastCounter[msg.sender] + 1;

        emit StakingFeastCreated(msg.sender, address(feastAddress), _rewardAsset);
    }

    function adminRenonceAdmin(address _newAdmin) external onlyAdmin {
        grantRole(DEFAULT_ADMIN_ROLE, _newAdmin);
        renounceRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function setNUTStaking(bytes32 _nut, uint256 _stakedAmount) public onlyAdmin {
        NUT = _nut;
        stakedNUT = _stakedAmount;
    }

}
