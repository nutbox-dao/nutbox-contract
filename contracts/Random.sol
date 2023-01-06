pragma solidity ^0.8.0;

// SPDX-License-Identifier: Apache-2.0

contract Random {
    uint256 internal constant maskLast8Bits = uint256(0x00000000000000000000000000000000000000000000000000000000000000FF);
    uint256 internal constant maskFirst248Bits = uint256(0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF00);

    mapping(uint256 => bytes32) public randoms;

    function getRandom(uint256 blockNumber) external returns (bytes32) {
        bytes32 randomN = randoms[blockNumber];
        if (randomN == 0) {
            randomN = blockhash(blockNumber);
            if (randomN == 0) {
                blockNumber = (block.number & maskFirst248Bits) + (blockNumber & maskLast8Bits);
                if (blockNumber >= block.number) blockNumber -= 256;
                randomN = blockhash(blockNumber);
            }
            if (blockNumber != 0) {
                randoms[blockNumber] = randomN;
            }
        }
        return keccak256(abi.encode(randomN, blockNumber));
    }
}
