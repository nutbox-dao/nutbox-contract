// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/utils/math/SafeMath.sol';

interface PNUT {
    function transfer(address recipient, uint256 amount) external returns (bool);
    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract PnutExchange is Ownable {
    // decimals = 6
    // 0x0d66aB1bb0D3E71211829c6D920eF933b8FE5122
    address public immutable oldPnut;
    // decimals = 18
    address public immutable newPnut;
    using SafeMath for uint256;

    event AdminHarvestNewPnut(uint256 amount);
    // amount decimals is 6 -- old pnut
    event UserExchangePnut(address indexed user, uint256 amount);

    constructor(address _oldPnut, address _newPnut) {
        oldPnut = _oldPnut;
        newPnut = _newPnut;
    }

    function harvestNewPnut(uint256 amount) public onlyOwner {
        PNUT _newPnut = PNUT(newPnut);
        uint256 balance = _newPnut.balanceOf(address(this));
        require(balance > amount, 'Insuffietint balance');
        _newPnut.transfer(msg.sender, amount);
        emit AdminHarvestNewPnut(amount);
    }

    function exchange(uint256 amount) public {
        PNUT _oldPnut = PNUT(oldPnut);
        PNUT _newPnut = PNUT(newPnut);
        uint256 userBalance = _oldPnut.balanceOf(msg.sender);
        uint256 balance = _newPnut.balanceOf(address(this));
        require(userBalance > amount, 'User insuffietint balance');
        require(balance > amount.mul(1e12), 'Contract insuffietint balance');

        _oldPnut.transferFrom(msg.sender, address(this), amount);
        _newPnut.transfer(msg.sender, amount.mul(1e12));
        emit UserExchangePnut(msg.sender, amount);
    }
}