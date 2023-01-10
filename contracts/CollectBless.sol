// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC1155/presets/ERC1155PresetMinterPauser.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "./Random.sol";
import "./Utils.sol";

contract CollectBless is Ownable, ReentrancyGuard, IERC721Receiver, IERC1155Receiver {
    /**
    Prize type
     */
    enum PrizeType {
        NONE,
        ERC20,
        ERC721,
        ERC1155
    }

    /**
    @dev Blind box data structure
     */
    struct BlindBox {
        uint256 id;
        // prize type
        PrizeType prizeType;
        // Prize contract address
        address token;
        // Creator
        address creator;
        // random weight
        uint16 weights;
        // Number of prizes
        uint256 amount;
        uint256 nftId;
        uint256 seedBlock;
    }

    /**
    Random contract address
     */
    Random public random;

    /**
    Bless card contract address
     */
    ERC1155PresetMinterPauser public blessCard;

    /**
    Prize pool token (USDT)
     */
    IERC20 public prizePoolToken;

    /**
    Rare card price
     */
    uint256 public rareCardPrice = 0.2 ether;

    /**
    Blind box price
     */
    uint256 public blindBoxPrice = 1 ether;

    /**
    Event end time
     */
    uint256 public eventEndTime;

    /**
    The number of rare cards
     */
    uint256 public rareCardCount = 0;

    /**
    Blind box list
    id => BlindBox
     */
    mapping(uint256 => BlindBox) public blindBoxs;
    uint256 public blindBoxCount = 0;

    /**
    Total Prize Pool Amount
     */
    uint256 public prizePoolAmount = 0;

    /**
    user address => count
     */
    mapping(address => uint256) public mintBoxCounts;

    /**
    uaer address => count
     */
    mapping(address => uint256) public openBoxCounts;

    // user address => blind box ids
    mapping(address => uint256[]) userOpenBoxs;
    // user address => total weights
    mapping(address => uint256) public userWeights;

    uint256 public rareCradId = 5;

    // weight configuration
    uint256[] private weightsConfig;
    uint16[5] private weightsValue = [uint16(1), 2, 3, 5, 10];

    // blind box pool, blind box id array
    uint256[] private blindBoxPool;

    // all user total weights
    uint256 public totalWeights = 0;

    // Bonuses already claimed by the user
    mapping(address => uint256) public alreadyReceived;

    bytes32 private randomFactor;

    // whitelist nft start id
    uint256 public whitelistIdCount = 99;

    // mint user => id
    mapping(address => uint256) public whitelistId;

    event MintBox(address indexed creator, uint256[] ids);
    event OpenBox(address indexed user, uint256[] ids);

    function init(
        address blessCardAddr,
        address tokenAddr,
        address randomAddr,
        uint256 endTime
    ) public onlyOwner {
        require(address(blessCard) == address(0), "already initialized");
        require(blessCardAddr != address(0), "invalid bless card NFT contract address");
        require(randomAddr != address(0), "invalid random contract address");
        require(tokenAddr != address(0), "invalid prize pool token contract address");
        require(endTime > block.timestamp, "end time too short");
        blessCard = ERC1155PresetMinterPauser(blessCardAddr);
        random = Random(randomAddr);
        eventEndTime = endTime;
        prizePoolToken = IERC20(tokenAddr);

        weightsConfig.push(50);
        weightsConfig.push(20);
        weightsConfig.push(15);
        weightsConfig.push(10);
        weightsConfig.push(5);

        bytes32 seed = random.getRandom(0);
        randomFactor = keccak256(abi.encodePacked(randomFactor, seed));
    }

    /**
    Set rare card price
     */
    function setRareCardPrice(uint256 price) public onlyOwner {
        rareCardPrice = price;
    }

    /**
    Set blind box price
     */
    function setBlindBoxPrice(uint256 price) public onlyOwner {
        blindBoxPrice = price;
    }

    function setEventEndTime(uint256 newTime) public onlyOwner {
        eventEndTime = newTime;
    }

    function getUserOpenBoxs(address user) public view returns (uint256[] memory) {
        return userOpenBoxs[user];
    }

    /**
    Create a token blind box
     */
    function mintBox(
        address token,
        uint256 quantity,
        uint256 totalAmount
    ) public {
        require(eventEndTime > block.timestamp, "has ended");
        require(token != address(0), "invalid token address");
        require(quantity > 1, "quantity is too small");

        uint256 amount = totalAmount / quantity;
        require(amount > 1, "totalAmount is too small");

        // get box token
        IERC20(token).transferFrom(msg.sender, address(this), amount * quantity);

        // get prize pool token
        uint256 fee = blindBoxPrice * quantity;
        prizePoolToken.transferFrom(msg.sender, address(this), fee);

        prizePoolAmount += fee;
        mintBoxCounts[msg.sender] += quantity;

        uint256[] memory ids = new uint256[](quantity);
        for (uint256 i = 0; i < quantity; i++) {
            blindBoxCount += 1;
            ids[i] = blindBoxCount;
            BlindBox storage bb = blindBoxs[blindBoxCount];
            bb.id = blindBoxCount;
            bb.prizeType = PrizeType.ERC20;
            bb.creator = msg.sender;
            bb.token = token;
            bb.seedBlock = block.number + 1;
            bb.amount = amount;

            blindBoxPool.push(blindBoxCount);
        }
        emit MintBox(msg.sender, ids);
    }

    /**
    Create a ERC721 NFT blind box
     */
    function mintBoxNFT721(address addr, uint256 nftId) public {
        require(eventEndTime > block.timestamp, "has ended");
        require(addr != address(0), "invalid NFT contract address");

        prizePoolToken.transferFrom(msg.sender, address(this), blindBoxPrice);

        IERC721(addr).safeTransferFrom(msg.sender, address(this), nftId);

        prizePoolAmount += blindBoxPrice;
        mintBoxCounts[msg.sender] += 1;

        blindBoxCount += 1;
        BlindBox storage bb = blindBoxs[blindBoxCount];
        bb.id = blindBoxCount;
        bb.prizeType = PrizeType.ERC721;
        bb.creator = msg.sender;
        bb.token = addr;
        bb.seedBlock = block.number + 1;
        bb.nftId = nftId;

        blindBoxPool.push(blindBoxCount);

        uint256[] memory ids = new uint256[](1);
        ids[0] = blindBoxCount;
        emit MintBox(msg.sender, ids);
    }

    /**
    Create ERC1155 NFT blind box
     */
    function mintBoxNFT1155(
        address addr,
        uint256 nftId,
        uint256 quantity
    ) public {
        require(eventEndTime > block.timestamp, "has ended");
        require(addr != address(0), "invalid NFT contract address");
        require(quantity >= 1, "quantity is too small");

        bytes memory data = new bytes(1);
        IERC1155(addr).safeTransferFrom(msg.sender, address(this), nftId, quantity, data);

        uint256 fee = blindBoxPrice * quantity;
        prizePoolToken.transferFrom(msg.sender, address(this), fee);

        prizePoolAmount += fee;
        mintBoxCounts[msg.sender] += quantity;

        uint256[] memory ids = new uint256[](quantity);
        for (uint256 i = 0; i < quantity; i++) {
            blindBoxCount += 1;
            ids[i] = blindBoxCount;
            BlindBox storage bb = blindBoxs[blindBoxCount];
            bb.id = blindBoxCount;
            bb.prizeType = PrizeType.ERC1155;
            bb.creator = msg.sender;
            bb.token = addr;
            bb.seedBlock = block.number + 1;
            bb.amount = 1;
            bb.nftId = nftId;

            blindBoxPool.push(bb.id);
        }

        emit MintBox(msg.sender, ids);
    }

    function mintWhitelistNFT(uint256 quantity) public {
        require(quantity >= 1, "quantity is too small");

        uint256 fee = blindBoxPrice * quantity;
        prizePoolToken.transferFrom(msg.sender, address(this), fee);

        prizePoolAmount += fee;
        mintBoxCounts[msg.sender] += quantity;

        uint256 nftId = whitelistId[msg.sender];
        if (nftId == 0) {
            whitelistIdCount += 1;
            nftId = whitelistIdCount;
            whitelistId[msg.sender] = nftId;
        }

        uint256[] memory ids = new uint256[](quantity);
        for (uint256 i = 0; i < quantity; i++) {
            blindBoxCount += 1;
            ids[i] = blindBoxCount;
            BlindBox storage bb = blindBoxs[blindBoxCount];
            bb.id = blindBoxCount;
            bb.prizeType = PrizeType.ERC1155;
            bb.creator = msg.sender;
            bb.token = address(blessCard);
            bb.seedBlock = block.number + 1;
            bb.amount = 1;
            bb.nftId = nftId;

            blindBoxPool.push(bb.id);
        }

        bytes memory data = new bytes(1);
        blessCard.mint(address(this), nftId, quantity, data);

        emit MintBox(msg.sender, ids);
    }

    /**
    Mint Rare Cards
     */
    function mintRareCard(uint256 quantity, address to) public {
        require(eventEndTime > block.timestamp, "has ended");
        require(quantity > 0, "quantity is too small");

        uint256 fee = rareCardPrice * quantity;
        prizePoolToken.transferFrom(msg.sender, address(this), fee);

        bytes memory data = new bytes(1);
        blessCard.mint(to, rareCradId, quantity, data);

        prizePoolAmount += fee;
        rareCardCount += quantity;
    }

    function mintRareCardBatch(address[] memory tos, uint256[] memory quantities) public nonReentrant {
        require(eventEndTime > block.timestamp, "has ended");
        require(tos.length == quantities.length, "invalid datas");

        uint256 fee;
        bytes memory data = new bytes(1);
        for (uint256 i = 0; i < tos.length; i++) {
            fee += rareCardPrice * quantities[i];
            blessCard.mint(tos[i], rareCradId, quantities[i], data);
            rareCardCount += quantities[i];
        }
        prizePoolToken.transferFrom(msg.sender, address(this), fee);
        prizePoolAmount += fee;
    }

    /**
    Mint normal card
     */
    function mintCard(
        address[] memory tos,
        uint256[] memory ids,
        uint256[] memory quantities
    ) public onlyOwner {
        require(eventEndTime > block.timestamp, "has ended");
        require(tos.length > 0, "invalid to address");
        require(tos.length == ids.length, "invalid data array");
        require(tos.length == quantities.length, "invalid data array");

        bytes memory data = new bytes(1);
        for (uint256 i = 0; i < tos.length; i++) {
            require(quantities[i] > 0, "quantity is too small");
            require(ids[i] >= 1 && ids[i] <= 4, "invalid id");
            blessCard.mint(tos[i], ids[i], quantities[i], data);
        }
    }

    /**
    Consume the card and open the blind box
     */
    function openBox(uint256 quantity) public {
        require(eventEndTime > block.timestamp, "has ended");
        require(quantity > 0, "quantity is too small");
        require(quantity <= 10, "quantity is too big");

        uint256[] memory ids = new uint256[](5);
        ids[0] = 1;
        ids[1] = 2;
        ids[2] = 3;
        ids[3] = 4;
        ids[4] = rareCradId;
        uint256[] memory amounts = new uint256[](5);
        amounts[0] = quantity;
        amounts[1] = quantity;
        amounts[2] = quantity;
        amounts[3] = quantity;
        amounts[4] = quantity;

        blessCard.burnBatch(msg.sender, ids, amounts);
        rareCardCount -= quantity;

        uint256[] memory outIds = new uint256[](quantity);
        bytes32 seed = random.getRandom(0);
        randomFactor = keccak256(abi.encodePacked(randomFactor, seed));
        for (uint256 i = 0; i < quantity; i++) {
            outIds[i] = _openBox(msg.sender, i, seed);
        }

        emit OpenBox(msg.sender, outIds);
    }

    function _openBox(
        address to,
        uint256 idx,
        bytes32 seed
    ) private nonReentrant returns (uint256) {
        bool isBlind = true;
        uint256 wIdx = 0;
        if (blindBoxPool.length < 1) {
            isBlind = false;
        } else {
            uint256 w = Utils.randomUint(abi.encodePacked(seed, randomFactor, to, idx, "blind"), 1, 100);
            if (w > 50) {
                isBlind = false;
            }
        }

        if (isBlind) {
            uint256 index = Utils.randomUint(abi.encodePacked(seed, randomFactor, to, idx, "eIndex"), 0, blindBoxPool.length - 1);
            BlindBox storage bb = blindBoxs[blindBoxPool[index]];

            if (bb.prizeType == PrizeType.ERC20) {
                IERC20(bb.token).transfer(to, bb.amount);
            } else if (bb.prizeType == PrizeType.ERC721) {
                IERC721(bb.token).safeTransferFrom(address(this), to, bb.nftId);
            } else if (bb.prizeType == PrizeType.ERC1155) {
                bytes memory data = new bytes(1);
                IERC1155(bb.token).safeTransferFrom(address(this), to, bb.nftId, bb.amount, data);
            }

            seed = random.getRandom(bb.seedBlock);
            wIdx = Utils.randomWeight(abi.encodePacked(seed, randomFactor, to, idx, "weights"), weightsConfig, 100);
            bb.weights = weightsValue[wIdx];

            // del from pool
            blindBoxPool[index] = blindBoxPool[blindBoxPool.length - 1];
            blindBoxPool.pop();

            openBoxCounts[bb.creator] += 1;
            userOpenBoxs[to].push(bb.id);
            userWeights[to] += bb.weights;
            totalWeights += bb.weights;

            return bb.id;
        } else {
            blindBoxCount += 1;
            BlindBox storage bb = blindBoxs[blindBoxCount];
            bb.id = blindBoxCount;
            bb.prizeType = PrizeType.NONE;
            bb.creator = address(0);
            bb.token = address(0);
            wIdx = Utils.randomWeight(abi.encodePacked(seed, randomFactor, to, idx, "weights"), weightsConfig, 100);
            bb.weights = weightsValue[wIdx];

            userOpenBoxs[to].push(blindBoxCount);
            userWeights[to] += bb.weights;
            totalWeights += bb.weights;

            return blindBoxCount;
        }
    }

    /**
    Receive the total prize according to the weight obtained
     */
    function cashPrize() public {
        require(eventEndTime < block.timestamp, "Not yet draw time");
        require(totalWeights > 0, "weights is 0");
        require(alreadyReceived[msg.sender] == 0, "you have already received");

        uint256 value = (prizePoolAmount * userWeights[msg.sender]) / totalWeights;
        if (value > 0) {
            alreadyReceived[msg.sender] = value;
            prizePoolToken.transfer(msg.sender, value);
        }
    }

    /**
    Claim an unopened blind box
     */
    function claimBlindBox(uint256 _limit) public {
        require(eventEndTime < block.timestamp, "The event is not over yet");

        uint256 limit = 300;
        if (_limit != 0) {
            limit = _limit;
        }

        if (mintBoxCounts[msg.sender] - openBoxCounts[msg.sender] > 0) {
            uint256 j = 0;
            bytes memory data = new bytes(1);
            for (uint256 i = 0; j < limit && i < blindBoxPool.length; j++) {
                BlindBox storage bb = blindBoxs[blindBoxPool[i]];
                if (bb.creator == msg.sender) {
                    openBoxCounts[msg.sender] += 1;
                    blindBoxPool[i] = blindBoxPool[blindBoxPool.length - 1];
                    blindBoxPool.pop();
                    if (bb.prizeType == PrizeType.ERC20) {
                        IERC20(bb.token).transfer(msg.sender, bb.amount);
                    } else if (bb.prizeType == PrizeType.ERC721) {
                        IERC721(bb.token).safeTransferFrom(address(this), msg.sender, bb.nftId);
                    } else if (bb.prizeType == PrizeType.ERC1155) {
                        IERC1155(bb.token).safeTransferFrom(address(this), msg.sender, bb.nftId, bb.amount, data);
                    }
                } else {
                    i++;
                }
            }
        }
    }

    function claimBlindBox2(uint256 _limit) public {
        require(eventEndTime < block.timestamp, "The event is not over yet");

        uint256 limit = 300;
        if (_limit != 0) {
            limit = _limit;
        }

        uint256 j = 0;
        bytes memory data = new bytes(1);
        for (int256 i = int256(blindBoxPool.length - 1); j < limit && i >= 0; j++) {
            BlindBox storage bb = blindBoxs[blindBoxPool[uint256(i)]];
            openBoxCounts[bb.creator] += 1;
            blindBoxPool.pop();
            i = int256(blindBoxPool.length - 1);
            if (bb.prizeType == PrizeType.ERC20) {
                IERC20(bb.token).transfer(bb.creator, bb.amount);
            } else if (bb.prizeType == PrizeType.ERC721) {
                IERC721(bb.token).safeTransferFrom(address(this), bb.creator, bb.nftId);
            } else if (bb.prizeType == PrizeType.ERC1155) {
                IERC1155(bb.token).safeTransferFrom(address(this), bb.creator, bb.nftId, bb.amount, data);
            }
        }
    }

    function getUserOpendBox(
        address user,
        uint256 startIndex,
        uint256 lastIndex
    ) public view returns (BlindBox[] memory boxes) {
        require(startIndex < lastIndex, "Wrong index param");
        uint256[] memory ids = userOpenBoxs[user];
        if (ids.length == 0) {
            return boxes;
        }
        uint256 len = ids.length;
        if (len <= startIndex) {
            return boxes;
        }
        if (len <= lastIndex) {
            lastIndex = len;
        }
        boxes = new BlindBox[](lastIndex - startIndex);
        uint256 i = 0;
        for (uint256 j = startIndex; j < lastIndex; j++) {
            boxes[i] = blindBoxs[ids[j]];
            i++;
        }
        return boxes;
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) public pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    function onERC1155Received(
        address,
        address,
        uint256,
        uint256,
        bytes calldata
    ) public pure override returns (bytes4) {
        return IERC1155Receiver.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address,
        address,
        uint256[] calldata,
        uint256[] calldata,
        bytes calldata
    ) public pure override returns (bytes4) {
        return 0;
    }

    function supportsInterface(bytes4 interfaceId) public pure override returns (bool) {
        return interfaceId == type(IERC721Receiver).interfaceId || interfaceId == type(IERC1155Receiver).interfaceId;
    }
}
