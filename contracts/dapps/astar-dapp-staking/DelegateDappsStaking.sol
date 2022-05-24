// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma abicoder v2;

import "./DappsStaking.sol";
import "./IAstarDappStakingConfig.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract DelegateDappsStaking is IAstarDappStakingConfig, Ownable {
    address public dappsStaking = 0x0000000000000000000000000000000000005001;
    uint256 public override precision = 10e18;
    uint256 public override minimumStake = 5e18; // Note: This parameter is different for different chains
    uint256 public override maxUnlockingChunks = 32;

    function setDappsStaking(address contractAddress) public onlyOwner {
        dappsStaking = contractAddress;
    }

    function setMinimumStake(uint256 _minimumStake) public onlyOwner {
        minimumStake = _minimumStake;
    }

    function read_current_era() public view returns (uint256) {
        return DappsStaking(dappsStaking).read_current_era();
    }

    function read_unbonding_period() public view returns (uint256) {
        return DappsStaking(dappsStaking).read_unbonding_period();
    }

    function read_era_reward(uint32 era) public view returns (uint128) {
        return DappsStaking(dappsStaking).read_era_reward(era);
    }

    function read_era_staked(uint32 era) public view returns (uint128) {
        return DappsStaking(dappsStaking).read_era_staked(era);
    }

    function read_staked_amount(bytes calldata staker) public view returns (uint128) {
        return DappsStaking(dappsStaking).read_staked_amount(staker);
    }

    function read_staked_amount_on_contract(address contract_id, bytes calldata staker) public view returns (uint128) {
        return DappsStaking(dappsStaking).read_staked_amount_on_contract(contract_id, staker);
    }

    function read_contract_stake(address contract_id) public view returns (uint128) {
        return DappsStaking(dappsStaking).read_contract_stake(contract_id);
    }

    function register(address dapp) public {
        (bool success, ) = dappsStaking.delegatecall(abi.encodeWithSelector(DappsStaking.register.selector, dapp));
        require(success, "register error");
    }

    function bond_and_stake(address dapp, uint256 amount) public {
        (bool success, ) = dappsStaking.delegatecall(abi.encodeWithSelector(DappsStaking.bond_and_stake.selector, dapp, uint128(amount)));
        require(success, "bond_and_stake error");
    }

    function unbond_and_unstake(address dapp, uint256 amount) public {
        (bool success, ) = dappsStaking.delegatecall(abi.encodeWithSelector(DappsStaking.unbond_and_unstake.selector, dapp, uint128(amount)));
        require(success, "unbond_and_unstake error");
    }

    function withdraw_unbonded() public {
        (bool success, ) = dappsStaking.delegatecall(abi.encodeWithSelector(DappsStaking.withdraw_unbonded.selector));
        require(success, "withdraw_unbonded error");
    }

    function claim_staker(address dapp) public {
        (bool success, ) = dappsStaking.delegatecall(abi.encodeWithSelector(DappsStaking.claim_staker.selector, dapp));
        require(success, "claim_staker error");
    }

    function claim_dapp(address dapp, uint256 era) public {
        (bool success, ) = dappsStaking.delegatecall(abi.encodeWithSelector(DappsStaking.claim_dapp.selector, dapp, uint128(era)));
        require(success, "claim_dapp error");
    }

    function set_reward_destination(uint256 reward_destination) public {
        (bool success, ) = dappsStaking.delegatecall(
            abi.encodeWithSelector(DappsStaking.set_reward_destination.selector, DappsStaking.RewardDestination(reward_destination))
        );
        require(success, "set_reward_destination error");
    }

    function withdraw_from_unregistered(address dapp) public {
        (bool success, ) = dappsStaking.delegatecall(abi.encodeWithSelector(DappsStaking.withdraw_from_unregistered.selector, dapp));
        require(success, "withdraw_from_unregistered error");
    }

    function nomination_transfer(
        address origin_smart_contract,
        uint128 amount,
        address target_smart_contract
    ) public {
        (bool success, ) = dappsStaking.delegatecall(
            abi.encodeWithSelector(DappsStaking.nomination_transfer.selector, origin_smart_contract, amount, target_smart_contract)
        );
        require(success, "nomination_transfer error");
    }
}
