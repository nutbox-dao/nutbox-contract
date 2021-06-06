// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import '@openzeppelin/contracts/utils/math/SafeMath.sol';
import '@openzeppelin/contracts/access/AccessControl.sol';
import '../common/Types.sol';
import './interfaces/IBridge.sol';
import './interfaces/IExecutor.sol';

contract Bridge is AccessControl, IBridge {
    using SafeMath for uint256;

    uint256 public threadhold;
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

    function adminAddRelayer(address relayer) external onlyAdmin {
        require(relayerRegistry[relayer] == false, 'Address already marked as relayer');
        relayerRegistry[relayer] = true;
    }

    function adminRemoveRelayer(address relayer) external onlyAdmin {
        require(relayerRegistry[relayer] == true, 'Address has not been marked as relayer');
        relayerRegistry[relayer] = false;
        relayerCount--;
    }

    function adminSetThreadhold(uint256 _threadhold) external onlyAdmin {
        require(_threadhold >= 1, 'Invalid threadhold value');
        threadhold = _threadhold;
    }

    function adminSetFee(uint256 _fee) external onlyAdmin{
        fee = _fee;
    }

    function adminSetExpiry(uint256 _expiry) external onlyAdmin{
        expiry = _expiry;
    }

    function adminRenonceAdmin(address _newAdmin) external onlyAdmin {
        grantRole(DEFAULT_ADMIN_ROLE, _newAdmin);
        renounceRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function getProposal(uint8 chainId, uint64 sequence, bytes32 extrinsicHash) override external view returns(Types.Proposal memory) {
        return proposalHistory[keccak256(abi.encodePacked(chainId, sequence, extrinsicHash))];
    }

    // keccak256(chainId, sequence, extrinsicHash)
    function voteProposal(uint8 chainId, uint64 sequence, bytes32 extrinsicHash) override external {
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
        } else {
            if (block.number.sub(proposal.createdHeight) > expiry) {
                proposal.status = Types.ProposalStatus.Cancelled;
                emit ProposalCancelled(proposal, msg.sender);
            } else {
                require(proposal.extrinsicHash == extrinsicHash, 'Extrinsic hash mismatch');
                hasVotedOnProposal[proposalId][msg.sender] = true;
                proposal.ayeVotes = proposal.ayeVotes + 1;
                emit ProposalVoted(proposal, msg.sender);
            }
        }

        if (proposal.status != Types.ProposalStatus.Cancelled) {
            if (threadhold <= 1 || proposal.ayeVotes >= threadhold) {
                proposal.status = Types.ProposalStatus.Passed;
                emit ProposalPassed(proposal, msg.sender);
            }
        }
    }

    function executeProposal(uint8 chainId, uint64 sequence, bytes32 extrinsicHash, bytes calldata extrinsic) override external {
        // check relayer
        require(relayerRegistry[msg.sender] == true, 'Permission denied: sender is not relayer');

        bytes32 proposalId = keccak256(abi.encodePacked(chainId, sequence, extrinsicHash));
        Types.Proposal storage proposal = proposalHistory[proposalId];

        require(proposal.status == Types.ProposalStatus.Passed, "Proposal can not be executed under current status");

        // execute proposal
        bytes memory data = abi.encodeWithSignature(
            "executeProposal(bytes)",
            extrinsic
        );
        (bool success,) = executor.call(data);
        require(success, "failed to call executor");

        proposal.status = Types.ProposalStatus.Executed;
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
}
