// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IWormholeFund {
    /**
    @dev Add an unclaimed reward, this method can only be called by the Task contract.
    When calling, the corresponding Token must be transferred.
    @param twitterId user twitter id
    @param token reward token address
    @param amount reward amount
    */
    function pushAward(
        uint256 twitterId,
        address token,
        uint256 amount
    ) external;
}
