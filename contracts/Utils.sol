pragma solidity ^0.8.0;

// SPDX-License-Identifier: MIT

library Utils {
    function randomUint(
        bytes memory seed,
        uint256 min,
        uint256 max
    ) internal pure returns (uint256) {
        if (min >= max) {
            return min;
        }
        uint256 number = uint256(keccak256(seed));
        return (number % (max - min + 1)) + min;
    }

    function randomInt(
        bytes memory seed,
        int256 min,
        int256 max
    ) internal pure returns (int256) {
        if (min >= max) {
            return min;
        }
        int256 number = int256(uint256(keccak256(seed)));
        return (number % (max - min + 1)) + min;
    }

    function randomWeight(
        bytes memory seed,
        uint256[] memory weights,
        uint256 totalWeight
    ) internal pure returns (uint256) {
        uint256 number = Utils.randomUint(seed, 1, totalWeight);
        uint256 last;
        for (uint256 i = 0; i != weights.length - 1; i++) {
            last += weights[i];
            if (number <= last) {
                return i;
            }
        }
        return weights.length - 1;
    }

    function randomWeightR(
        bytes memory seed,
        uint256[] memory weights,
        uint256 totalWeight
    ) internal pure returns (uint256) {
        uint256 number = Utils.randomUint(seed, 1, totalWeight);

        for (uint256 i = weights.length - 1; i != 0; --i) {
            if (number <= weights[i]) {
                return i;
            }
            number -= weights[i];
        }
        return 0;
    }

    function randomBool(
        bytes memory seed,
        uint256 nume,
        uint256 deno
    ) internal pure returns (bool) {
        uint256 rand = Utils.randomUint(seed, 1, deno);
        return rand <= nume;
    }

    function toUint8(bytes memory _bytes, uint256 _start) internal pure returns (uint8) {
        require(_start + 1 >= _start, "toUint8_overflow");
        require(_bytes.length >= _start + 1, "toUint8_outOfBounds");
        uint8 tempUint;
        assembly {
            tempUint := mload(add(add(_bytes, 0x1), _start))
        }
        return tempUint;
    }

    function toUint16(bytes memory _bytes, uint256 _start) internal pure returns (uint16) {
        require(_start + 2 >= _start, "toUint16_overflow");
        require(_bytes.length >= _start + 2, "toUint16_outOfBounds");
        uint16 tempUint;
        assembly {
            tempUint := mload(add(add(_bytes, 0x2), _start))
        }
        return tempUint;
    }

    function toUint32(bytes memory _bytes, uint256 _start) internal pure returns (uint32) {
        require(_start + 4 >= _start, "toUint32_overflow");
        require(_bytes.length >= _start + 4, "toUint32_outOfBounds");
        uint32 tempUint;
        assembly {
            tempUint := mload(add(add(_bytes, 0x4), _start))
        }
        return tempUint;
    }

    function toUint64(bytes memory _bytes, uint256 _start) internal pure returns (uint64) {
        require(_start + 8 >= _start, "toUint64_overflow");
        require(_bytes.length >= _start + 8, "toUint64_outOfBounds");
        uint64 tempUint;
        assembly {
            tempUint := mload(add(add(_bytes, 0x8), _start))
        }
        return tempUint;
    }

    function toUint128(bytes memory _bytes, uint256 _start) internal pure returns (uint128) {
        require(_start + 16 >= _start, "toUint128_overflow");
        require(_bytes.length >= _start + 16, "toUint128_outOfBounds");
        uint128 tempUint;
        assembly {
            tempUint := mload(add(add(_bytes, 0x10), _start))
        }
        return tempUint;
    }

    function toUint256(bytes memory _bytes, uint256 _start) internal pure returns (uint256) {
        require(_start + 32 >= _start, "toUint256_overflow");
        require(_bytes.length >= _start + 32, "toUint256_outOfBounds");
        uint256 tempUint;
        assembly {
            tempUint := mload(add(add(_bytes, 0x20), _start))
        }
        return tempUint;
    }
}
