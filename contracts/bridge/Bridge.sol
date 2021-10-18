// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import '@openzeppelin/contracts/utils/math/SafeMath.sol';
import '@openzeppelin/contracts/access/AccessControl.sol';
import '../common/Types.sol';
import './interfaces/IBridge.sol';
import './interfaces/IExecutor.sol';
import '../asset/interfaces/IRegistryHub.sol';

contract Bridge is AccessControl, IBridge {
    using SafeMath for uint256;

    uint256 public threshold;
    uint256 public relayerCount;
    uint256 public fee;
    uint256 public expiry;
    address public registryHub;
    address public executor;

    // relayer => isRelayer
    mapping (address => bool) public relayerRegistry;
    // chainId => sequence
    mapping(uint8 => uint64) public chainSequence;
    // proposalId => Proposal
    mapping(bytes32 => Types.Proposal) public proposalHistory;
    // proposalId => relayerAddress => bool
    mapping(bytes32 => mapping (address => bool)) public hasVotedOnProposal;

    event ProposalVoted(Types.Proposal proposal, address relayer);
    event ProposalCancelled(Types.Proposal proposal, address relayer);
    event ProposalPassed(Types.Proposal proposal, address relayer);
    event ProposalExecuted(Types.Proposal proposal, address relayer);
    event AdminSetExecutor(address executor);
    event AdminAddRelayer(address relayer);
    event AdminRemoveRelayer(address relayer);
    event AdminSetThreshold(uint256 threshold);
    event AdminSetFee(uint256 fee);
    event AdminSetExpiry(uint256 expiry);
    event AdminRenonceAdmin(address newAdmin);

    modifier onlyAdmin() {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Sender is not admin");
        _;
    }

    constructor(address _registryHub, address _executor, uint256 _fee, uint256 _expiry) public {
        require(_registryHub != address(0), 'Invalid registry hub address');
        require(_executor != address(0), 'Invalid executor address');

        registryHub = _registryHub;
        executor = _executor;
        fee = _fee;
        expiry = _expiry;

        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function adminSetExecutor(address _executor) external onlyAdmin {
        require(_executor != address(0), 'Invalid executor address');
        executor = _executor;
        emit AdminSetExecutor(_executor);
    }

    function adminAddRelayer(address relayer) external onlyAdmin {
        require(relayerRegistry[relayer] == false, 'Address already marked as relayer');
        relayerRegistry[relayer] = true;
        relayerCount++;
        emit AdminAddRelayer(relayer);
    }

    function adminRemoveRelayer(address relayer) external onlyAdmin {
        require(relayerRegistry[relayer] == true, 'Address has not been marked as relayer');
        relayerRegistry[relayer] = false;
        relayerCount--;
        emit AdminRemoveRelayer(relayer);
    }

    function adminSetThreshold(uint256 _threshold) external onlyAdmin {
        require(_threshold >= 1, 'Invalid threshold value');
        threshold = _threshold;
        emit AdminSetThreshold(_threshold);
    }

    function adminSetFee(uint256 _fee) external onlyAdmin{
        fee = _fee;
        emit AdminSetFee(_fee);
    }

    function adminSetExpiry(uint256 _expiry) external onlyAdmin{
        expiry = _expiry;
        emit AdminSetExpiry(_expiry);
    }

    function adminRenonceAdmin(address _newAdmin) external onlyAdmin {
        grantRole(DEFAULT_ADMIN_ROLE, _newAdmin);
        renounceRole(DEFAULT_ADMIN_ROLE, msg.sender);
        event AdminRenonceAdmin(_newAdmin);
    }

    function adminDepositAsset(bytes32 assetId, uint256 amount) public onlyAdmin {
        bytes32 source = keccak256(abi.encodePacked(address(this), assetId));
        bytes memory data = abi.encodeWithSignature(
            "lockAsset(bytes32,bytes32,address,uint256)",
            source,
            assetId,
            msg.sender,
            amount
        );
        (bool success,) = IRegistryHub(registryHub).getERC20AssetHandler().call(data);
        require(success, "failed to call lockAsset");
    }

    function getProposal(uint8 chainId, uint64 sequence, bytes32 extrinsicHash) override external view returns(Types.Proposal memory) {
        return proposalHistory[keccak256(abi.encodePacked(chainId, sequence, extrinsicHash))];
    }

    // keccak256(chainId, sequence, extrinsicHash)
    function voteProposal(uint8 chainId, uint64 sequence, bytes32 extrinsicHash, bytes calldata extrinsic) override external {
        // check relayer
        require(relayerRegistry[msg.sender] == true, 'Permission denied: sender is not relayer');

        bytes32 proposalId = keccak256(abi.encodePacked(chainId, sequence, extrinsicHash));
        Types.Proposal storage proposal = proposalHistory[proposalId];

        // check relayer vote record
        require(hasVotedOnProposal[proposalId][msg.sender] == false, 'Relayer already voted for this proposal');
        // check proposal status
        require(uint(proposal.status) <= uint(Types.ProposalStatus.Actived), 'Proposal can not be voted');

        if(uint(proposal.status) == uint(Types.ProposalStatus.Inactived)) {
            proposalHistory[proposalId] = Types.Proposal({
                status: Types.ProposalStatus.Actived,
                chainId: chainId,
                ayeVotes: 1,
                sequence: sequence,
                extrinsicHash: extrinsicHash,
                id: proposalId,
                createdHeight: block.number
            });
            // vote this proposal YES
            hasVotedOnProposal[proposalId][msg.sender] = true;
            emit ProposalVoted(proposal, msg.sender);
            _tryResolveProposal(proposalId, extrinsic);
        } else {
            if (block.number.sub(proposal.createdHeight) > expiry) {
                proposal.status = Types.ProposalStatus.Cancelled;
                emit ProposalCancelled(proposal, msg.sender);
            } else {
                require(proposal.extrinsicHash == extrinsicHash, 'Extrinsic hash mismatch');
                hasVotedOnProposal[proposalId][msg.sender] = true;
                proposal.ayeVotes = proposal.ayeVotes + 1;
                emit ProposalVoted(proposal, msg.sender);
                _tryResolveProposal(proposalId, extrinsic);
            }
        }
    }

    function cancelProposal(uint8 chainId, uint64 sequence, bytes32 extrinsicHash) override external {
        // check relayer
        require(relayerRegistry[msg.sender] == true, 'Permission denied: sender is not relayer');

        bytes32 proposalId = keccak256(abi.encodePacked(chainId, sequence, extrinsicHash));
        Types.Proposal storage proposal = proposalHistory[proposalId];

        require(proposal.status != Types.ProposalStatus.Cancelled, "Proposal already cancelled");

        proposal.status = Types.ProposalStatus.Cancelled;
        emit ProposalCancelled(proposal, msg.sender);
    }

    function _tryResolveProposal(bytes32 proposalId, bytes calldata extrinsic) private {
        Types.Proposal storage proposal = proposalHistory[proposalId];

        if (proposal.status != Types.ProposalStatus.Cancelled) {
            if (threshold <= 1 || proposal.ayeVotes >= threshold) {
                proposal.status = Types.ProposalStatus.Passed;
                emit ProposalPassed(proposal, msg.sender);

                // execute proposal
                bytes memory data = abi.encodeWithSignature(
                    "executeProposal(bytes)",
                    extrinsic
                );
                (bool success,) = executor.call(data);
                require(success, "failed to call executor");

                proposal.status = Types.ProposalStatus.Executed;

                emit ProposalExecuted(proposal, msg.sender);
            }
        }
    }
}
