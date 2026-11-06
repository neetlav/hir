// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @notice Attributable evidence, NOT policy enforcement. Authentic violations are recordable.
/// No ENS administration, token transfers, upgrade, owner, delete or overwrite functions.
contract HirAgentsEvidence {
    struct Request {
        bytes32 requestId; bytes32 agentNode; address requester; address receiver;
        bytes32 action; bytes32 inputHash; bytes32 parametersHash; uint8 mode;
        bytes32 priceTable; uint32 credits; bytes32 policyHash; bytes32 generation;
        uint64 createdAt; uint64 expiresAt;
    }
    struct Decision {
        bytes32 requestId; bytes32 requestDigest; bytes32 policyHash;
        bytes32 checkpointHash; uint256 checkpointNumber; uint8 assessed;
        bool accepted; bytes32 reasonHash; uint64 decidedAt;
    }
    struct Outcome {
        bytes32 requestId; bytes32 decisionDigest; uint8 status;
        bytes32 outputHash; uint64 completedAt;
    }
    bytes32 public constant REQUEST_TYPEHASH = keccak256("Request(bytes32 requestId,bytes32 agentNode,address requester,address receiver,bytes32 action,bytes32 inputHash,bytes32 parametersHash,uint8 mode,bytes32 priceTable,uint32 credits,bytes32 policyHash,bytes32 generation,uint64 createdAt,uint64 expiresAt)");
    bytes32 public constant DECISION_TYPEHASH = keccak256("Decision(bytes32 requestId,bytes32 requestDigest,bytes32 policyHash,bytes32 checkpointHash,uint256 checkpointNumber,uint8 assessed,bool accepted,bytes32 reasonHash,uint64 decidedAt)");
    bytes32 public constant OUTCOME_TYPEHASH = keccak256("Outcome(bytes32 requestId,bytes32 decisionDigest,uint8 status,bytes32 outputHash,uint64 completedAt)");
    bytes32 public constant SEAL_TYPEHASH = keccak256("Seal(bytes32 requestDigest,bytes32 decisionDigest,bytes32 outcomeDigest,bytes32 bundleHash)");
    bytes32 private constant DOMAIN_TYPEHASH = keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    mapping(bytes32 key => bytes32 commitment) public recorded;
    event EvidenceRecorded(bytes32 indexed key, bytes32 indexed requestDigest, bytes32 indexed decisionDigest, bytes32 outcomeDigest, bytes32 bundleHash, address requester, address receiver, bool accepted, uint8 assessed, uint8 status);
    error InvalidEvidence();
    error AlreadyRecorded();

    function domainSeparator() public view returns (bytes32) {
        return keccak256(abi.encode(DOMAIN_TYPEHASH, keccak256("HIR Agents"), keccak256("1"), block.chainid, address(this)));
    }
    function _digest(bytes32 structure) private view returns (bytes32) {
        return keccak256(abi.encodePacked(hex"1901", domainSeparator(), structure));
    }
    function requestDigest(Request calldata r) public view returns (bytes32) {return _digest(keccak256(abi.encode(REQUEST_TYPEHASH,r)));}
    function decisionDigest(Decision calldata d) public view returns (bytes32) {return _digest(keccak256(abi.encode(DECISION_TYPEHASH,d)));}
    function outcomeDigest(Outcome calldata o) public view returns (bytes32) {return _digest(keccak256(abi.encode(OUTCOME_TYPEHASH,o)));}

    function record(Request calldata r, bytes calldata rs, Decision calldata d, bytes calldata ds, Outcome calldata o, bytes calldata os, bytes32 bundleHash, bytes calldata sealSignature) external {
        bytes32 rd=requestDigest(r); bytes32 dd=decisionDigest(d); bytes32 od=outcomeDigest(o);
        bytes32 key=keccak256(abi.encode(r.requester,r.requestId));
        if(recorded[key]!=bytes32(0)) revert AlreadyRecorded();
        if(r.requester==address(0)||r.receiver==address(0)||r.requester==r.receiver||r.requestId==bytes32(0)||bundleHash==bytes32(0)) revert InvalidEvidence();
        if(ECDSA.recover(rd,rs)!=r.requester||ECDSA.recover(dd,ds)!=r.receiver||ECDSA.recover(od,os)!=r.receiver) revert InvalidEvidence();
        if(ECDSA.recover(_digest(keccak256(abi.encode(SEAL_TYPEHASH,rd,dd,od,bundleHash))),sealSignature)!=r.receiver) revert InvalidEvidence();
        if(d.requestId!=r.requestId||o.requestId!=r.requestId||d.requestDigest!=rd||o.decisionDigest!=dd||d.policyHash!=r.policyHash) revert InvalidEvidence();
        if(d.assessed>2||o.status>3||(d.accepted?o.status==0:o.status!=0)) revert InvalidEvidence();
        // No cap, price, expiry, ENS or compliance gate: historical and violating statements remain recordable.
        // Consumers must authenticate policy/timing/compliance independently.
        recorded[key]=keccak256(abi.encode(rd,dd,od,bundleHash));
        emit EvidenceRecorded(key,rd,dd,od,bundleHash,r.requester,r.receiver,d.accepted,d.assessed,o.status);
    }
}
