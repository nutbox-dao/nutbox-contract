// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "./SocialCurationFactory.sol";
import "../../interfaces/ICommunity.sol";
import "../../interfaces/ICommittee.sol";
import "../../interfaces/IPool.sol";
import "../../ERC20Helper.sol";

/**
 * @dev Social curation pool: no user stake/deposit. LinearCalculator rewards accrue to this contract
 *      as the sole virtual staker; users claim via EIP-712 signed permits (eth_signTypedData_v4).
 *
 *      Claim struct includes `chainId` (must match `block.chainid` at execution) and `pool` (this
 *      contract); verification uses `block.chainid` and `address(this)` so callers do not pass them
 *      as tx arguments.
 */
contract SocialCuration is IPool, ERC20Helper, ReentrancyGuard, Initializable, EIP712 {
    /// @dev Fixed virtual stake so Community keeps poolAcc updating (same scale as other pools).
    uint256 private constant VIRTUAL_STAKE = 1e18;

    /// @dev EIP-712 type hash for off-chain signing (MetaMask / ethers signTypedData).
    bytes32 private constant CLAIM_TYPEHASH =
        keccak256(
            "Claim(uint256 chainId,address pool,uint256 orderId,uint256 amount,address to,uint256 deadline)"
        );

    address public factory;
    address public community;

    mapping(address => mapping(uint256 => bool)) private claimedOrders;

    string public constant name = "Social Curation";

    uint256 public totalClaimed;

    event SocialClaimed(
        address indexed user,
        uint256 indexed orderId,
        uint256 amount,
        bool harvested
    );

    constructor() EIP712("Nutbox SocialCuration", "1") {
        _disableInitializers();
    }

    function initialize(address _community) external initializer {
        require(_community != address(0), "Invalid community");
        factory = msg.sender;
        community = _community;
    }

    /**
     * @notice Claim community tokens with a distributor EIP-712 signature.
     * @dev Off-chain `Claim.chainId` / `Claim.pool` must match execution context; contract uses
     *      `block.chainid` and `address(this)` when hashing.
     * @param orderId   Unique id per claim (replay protection on-chain).
     * @param amount    Amount of community token to receive.
     * @param deadline  Unix timestamp after which the signature is invalid.
     * @param signature ECDSA signature by `claimSigner` over the Claim struct.
     */
    function claim(
        uint256 orderId,
        uint256 amount,
        uint256 deadline,
        bytes calldata signature
    ) external payable nonReentrant {
        require(block.timestamp <= deadline, "Expired");
        require(amount > 0, "Amount=0");
        require(!claimedOrders[msg.sender][orderId], "Claimed");

        bytes32 structHash = keccak256(
            abi.encode(
                CLAIM_TYPEHASH,
                block.chainid,
                address(this),
                orderId,
                amount,
                msg.sender,
                deadline
            )
        );
        address recovered = ECDSA.recover(_hashTypedDataV4(structHash), signature);
        require(recovered == SocialCurationFactory(factory).claimSigner(), "Bad sig");

        address token = ICommunity(community).getCommunityToken();
        uint256 bal = IERC20(token).balanceOf(address(this));
        bool harvested;

        if (bal < amount) {
            // Single Tier-3 charge: paid inside Community.withdrawPoolsRewards (caller = this pool).
            ICommunity(community).withdrawPoolsRewards{value: msg.value}(_singlePoolArray());
            bal = IERC20(token).balanceOf(address(this));
            require(bal >= amount, "Insufficient bal");
            harvested = true;
        } else {
            // Balance already covers payout — charge Tier-3 here only (not on Community).
            _chargeTier3Fee();
        }

        claimedOrders[msg.sender][orderId] = true;
        totalClaimed += amount;

        releaseERC20(token, msg.sender, amount);

        _refundEthToUser();

        emit SocialClaimed(msg.sender, orderId, amount, harvested);
    }

    /// @dev Anyone may pull accrued Linear rewards into this pool (pays Tier-3 from msg.value).
    function harvestRewards() external payable nonReentrant {
        ICommunity(community).withdrawPoolsRewards{value: msg.value}(_singlePoolArray());
        _refundEthToUser();
    }

    function _singlePoolArray() private view returns (address[] memory pools) {
        pools = new address[](1);
        pools[0] = address(this);
    }

    function _chargeTier3Fee() private {
        address committeeAddr = ICommunity(community).getCommittee();
        uint256 fee = ICommittee(committeeAddr).getPoolOperationFee();
        if (fee == 0) return;
        if (ICommittee(committeeAddr).getFeeFree(msg.sender)) return;
        require(msg.value >= fee, "Insufficient fee");
        address payable recipient = ICommittee(committeeAddr).getFeeRecipient();
        (bool ok, ) = recipient.call{value: fee}("");
        require(ok, "Fee transfer failed");
        if (msg.value > fee) {
            (bool ok2, ) = msg.sender.call{value: msg.value - fee}("");
            require(ok2, "Refund failed");
        }
    }

    /// @dev Return ETH held by this contract (e.g. Community refund to pool) to the user / caller.
    function _refundEthToUser() private {
        uint256 ethBal = address(this).balance;
        if (ethBal == 0) return;
        (bool ok, ) = payable(msg.sender).call{value: ethBal}("");
        require(ok, "ETH refund failed");
    }

    function getFactory() external view override returns (address) {
        return factory;
    }

    function getCommunity() external view override returns (address) {
        return community;
    }

    /// @dev Virtual stake: only this contract is the staker so all pool rewards accrue to `address(this)` in Community.
    function getUserStakedAmount(address user) external view override returns (uint256) {
        if (user == address(this)) return VIRTUAL_STAKE;
        return 0;
    }

    function getTotalStakedAmount() external pure override returns (uint256) {
        return VIRTUAL_STAKE;
    }

    receive() external payable {}
}
