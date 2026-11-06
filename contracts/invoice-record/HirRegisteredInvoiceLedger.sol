// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
interface IRegisteredRecordRegistry {
 struct State {uint8 status;uint64 expiry;address latestOwner;uint256 tokenId;uint256 resource;}
 function getState(uint256 id) external view returns(State memory);
 function getSubregistry(string calldata label) external view returns(address);
 function getResolver(string calldata label) external view returns(address);
 function getParent() external view returns(address,string memory);
}
interface IRegisteredRecordUniversal {
 function ROOT_REGISTRY() external view returns(address);
 function isENSv2() external view returns(bool);
 function findResolver(bytes calldata name) external view returns(address,bytes32,uint256);
 function resolveWithGateways(bytes calldata name,bytes calldata data,string[] calldata gateways) external view returns(bytes memory,address);
}
interface IRegisteredRecordResolver {
 function getRecordId(bytes32 node) external view returns(uint256);
 function setData(bytes calldata name,string calldata key,bytes calldata value) external;
}
interface IENSRegistryFactory {function verifyContract(address proxy) external view returns(address implementation);}
/// @notice Invoice evidence requires actual registered ENS names through official UserRegistry proxies.
contract HirRegisteredInvoiceLedger is EIP712,ReentrancyGuard {
 struct Policy {uint32 version;bytes32 namespace;address ledger;uint256 chainId;address controller;uint256 ownershipResource;address resolver;bytes32 generation;address issuer;uint256 paymentChainId;address token;address recipient;}
 struct Invoice {bytes32 scope;bytes32 invoiceId;uint32 revision;bytes32 previousDigest;bytes32 pdfHash;bytes32 detailsHash;uint256 amount;uint256 paymentChainId;address token;address recipient;bytes32 policyHash;uint64 deadline;}
 struct Head {bytes32 digest;uint32 revision;}
 struct Acceptance {bytes32 scope;bytes32 invoiceId;bytes32 policyHash;address signer;uint64 blockNumber;}
 IRegisteredRecordUniversal public immutable universal;IRegisteredRecordRegistry public immutable ethRegistry;address public immutable rootRegistry;
 IENSRegistryFactory public immutable registryFactory;address public immutable registryImplementation;
 struct Registration {address organizationRegistry;address invoiceRegistry;uint256 namespaceResource;uint256 invoiceResource;uint64 organizationExpiry;uint64 namespaceExpiry;uint64 invoiceExpiry;}
 error InvalidRegistration();
 event InvoiceRegistrationChecked(bytes32 indexed digest,address organizationRegistry,address invoiceRegistry,uint256 namespaceResource,uint256 invoiceResource,uint64 organizationExpiry,uint64 namespaceExpiry,uint64 invoiceExpiry,address owner,address resolver);
 string public constant POLICY_KEY="hir.invoice.config.v2"; // Organization configuration explicitly binds the selected ledger.
 string public constant RECORD_KEY="hir.invoice.record";
 mapping(bytes32=>mapping(bytes32=>Head)) public heads;
 mapping(bytes32=>Acceptance) public accepted;
 mapping(bytes32=>mapping(bytes32=>uint256)) public recordIds;
 bytes32 public constant INVOICE_TYPEHASH=keccak256("Invoice(bytes32 scope,bytes32 invoiceId,uint32 revision,bytes32 previousDigest,bytes32 pdfHash,bytes32 detailsHash,uint256 amount,uint256 paymentChainId,address token,address recipient,bytes32 policyHash,uint64 deadline)");
 error InvalidIdentity();error InvalidPolicy();error StalePolicy();error UnapprovedDestination();error UnauthorizedSigner();error InvalidInvoice();error InvalidTransition();error ExpiredSignature();error InvalidName();error RecordConflict();error ResolverChanged();
 event InvoiceAccepted(bytes32 indexed scope,bytes32 indexed invoiceId,bytes32 indexed digest,bytes orgName,address resolver,bytes32 resolverCodeHash,bytes invoiceData,bytes policyData,bytes signature);
 event InvoiceRecordPublished(bytes32 indexed scope,bytes32 indexed invoiceId,bytes name,address resolver,uint256 recordId,bytes pointer);
 constructor(address u,address e,address factory,address implementation) EIP712("HIR Invoice","1") {universal=IRegisteredRecordUniversal(u);ethRegistry=IRegisteredRecordRegistry(e);if(!universal.isENSv2())revert InvalidIdentity();registryFactory=IENSRegistryFactory(factory);registryImplementation=implementation;if(factory.code.length==0||implementation.code.length==0)revert InvalidIdentity();rootRegistry=universal.ROOT_REGISTRY();if(IRegisteredRecordRegistry(rootRegistry).getSubregistry("eth")!=e)revert InvalidIdentity();}
 function namespace(bytes calldata org) public pure returns(bytes memory name,bytes32 node,uint256 labelId){
  if(org.length<7)revert InvalidIdentity();uint256 n=uint8(org[0]);if(n==0||n>63||org.length!=n+6||org[n+1]!=0x03||org[n+2]!=0x65||org[n+3]!=0x74||org[n+4]!=0x68||org[n+5]!=0)revert InvalidIdentity();
  for(uint256 i=1;i<=n;i++){uint8 c=uint8(org[i]);if(!((c>=97&&c<=122)||(c>=48&&c<=57)||c==45))revert InvalidIdentity();}
  bytes32 label=keccak256(org[1:n+1]);labelId=uint256(label);bytes32 parent=keccak256(abi.encodePacked(keccak256(abi.encodePacked(bytes32(0),keccak256("eth"))),label));node=keccak256(abi.encodePacked(parent,keccak256("invoices")));name=abi.encodePacked(hex"08696e766f69636573",org);
 }
 function invoiceName(bytes calldata org,string calldata label) public pure returns(bytes memory name,bytes32 node){
  bytes memory l=bytes(label);if(l.length==0||l.length>63||l[0]==0x2d||l[l.length-1]==0x2d)revert InvalidName();
  for(uint256 i;i<l.length;i++){uint8 c=uint8(l[i]);if(!((c>=97&&c<=122)||(c>=48&&c<=57)||c==45))revert InvalidName();}
  (bytes memory parent,bytes32 parentNode,)=namespace(org);name=abi.encodePacked(bytes1(uint8(l.length)),l,parent);node=keccak256(abi.encodePacked(parentNode,keccak256(l)));
 }
 function readPolicy(bytes calldata org) public view returns(Policy memory p,bytes memory raw,address resolver){
  (bytes memory name,bytes32 node,uint256 labelId)=namespace(org);if(!universal.isENSv2()||universal.ROOT_REGISTRY()!=rootRegistry||IRegisteredRecordRegistry(rootRegistry).getSubregistry("eth")!=address(ethRegistry))revert InvalidIdentity();
  IRegisteredRecordRegistry.State memory s=ethRegistry.getState(labelId);if(s.status!=2||s.expiry<=block.timestamp||s.latestOwner==address(0))revert InvalidIdentity();
  (bytes memory answer,address r)=universal.resolveWithGateways(name,abi.encodeWithSignature("data(bytes32,string)",bytes32(0),POLICY_KEY),new string[](0));raw=abi.decode(answer,(bytes));if(raw.length!=384||r.code.length==0)revert InvalidPolicy();p=abi.decode(raw,(Policy));resolver=r;
  if(keccak256(raw)!=keccak256(abi.encode(p))||p.version!=1||p.namespace!=node||p.ledger!=address(this)||p.chainId!=block.chainid||p.controller!=s.latestOwner||p.ownershipResource!=s.resource||p.resolver!=r||p.generation==0||p.issuer==address(0)||p.issuer==p.controller||p.issuer.code.length!=0||p.paymentChainId==0||p.token==address(0)||p.recipient==address(0))revert InvalidPolicy();
 }
 function registeredHierarchyRequired() external pure returns(bool){return true;}
 function _officialRegistry(address registry) internal view {
  if(registry==address(0))revert InvalidRegistration();
  try registryFactory.verifyContract(registry) returns(address implementation){if(implementation!=registryImplementation)revert InvalidRegistration();}catch{revert InvalidRegistration();}
 }
 function registration(bytes calldata org,string calldata label) external view returns(Registration memory){(Policy memory p,,)=readPolicy(org);return _registration(org,label,p);}
 function _registration(bytes calldata org,string calldata label,Policy memory p) internal view returns(Registration memory r){
  (, ,uint256 orgId)=namespace(org);string memory orgLabel=string(org[1:uint256(uint8(org[0]))+1]);
  r.organizationRegistry=ethRegistry.getSubregistry(orgLabel);_officialRegistry(r.organizationRegistry);
  IRegisteredRecordRegistry organizationRegistry=IRegisteredRecordRegistry(r.organizationRegistry);
  (address orgParent,string memory orgChild)=organizationRegistry.getParent();
  if(orgParent!=address(ethRegistry)||keccak256(bytes(orgChild))!=keccak256(bytes(orgLabel)))revert InvalidRegistration();
  r.invoiceRegistry=organizationRegistry.getSubregistry("invoices");_officialRegistry(r.invoiceRegistry);
  IRegisteredRecordRegistry invoiceRegistry=IRegisteredRecordRegistry(r.invoiceRegistry);
  (address invoiceParent,string memory invoiceChild)=invoiceRegistry.getParent();
  if(invoiceParent!=r.organizationRegistry||keccak256(bytes(invoiceChild))!=keccak256("invoices"))revert InvalidRegistration();
  IRegisteredRecordRegistry.State memory organizationState=ethRegistry.getState(orgId);
  IRegisteredRecordRegistry.State memory namespaceState=organizationRegistry.getState(uint256(keccak256("invoices")));
  IRegisteredRecordRegistry.State memory invoiceState=invoiceRegistry.getState(uint256(keccak256(bytes(label))));
  if(namespaceState.status!=2||invoiceState.status!=2||namespaceState.latestOwner!=p.controller||invoiceState.latestOwner!=p.controller||namespaceState.expiry<=block.timestamp||invoiceState.expiry<=block.timestamp||namespaceState.expiry>organizationState.expiry||invoiceState.expiry>namespaceState.expiry||organizationRegistry.getResolver("invoices")!=p.resolver||invoiceRegistry.getResolver(label)!=p.resolver)revert InvalidRegistration();
  r.namespaceResource=namespaceState.resource;r.invoiceResource=invoiceState.resource;r.organizationExpiry=organizationState.expiry;r.namespaceExpiry=namespaceState.expiry;r.invoiceExpiry=invoiceState.expiry;
 }
 function scope(Policy memory p) public view returns(bytes32){return keccak256(abi.encode(block.chainid,address(this),p.namespace,p.controller,p.ownershipResource,p.resolver,p.generation));}
 function invoiceDigest(Invoice calldata v) public view returns(bytes32){return _hashTypedDataV4(keccak256(abi.encode(INVOICE_TYPEHASH,v)));}
 function pointer(bytes32 s,bytes32 id) public view returns(bytes memory){return abi.encode(uint32(1),address(this),s,id);}
 function publish(bytes calldata org,string calldata label,Invoice calldata v,bytes calldata sig) external nonReentrant {
  (Policy memory p,bytes memory raw,address resolver)=readPolicy(org);(bytes memory name,bytes32 node)=invoiceName(org,label);
  if(v.invoiceId!=node)revert InvalidName();if(v.scope!=scope(p)||v.policyHash!=keccak256(raw))revert StalePolicy();
  if(v.paymentChainId!=p.paymentChainId||v.token!=p.token||v.recipient!=p.recipient)revert UnapprovedDestination();
  if(v.pdfHash==0||v.detailsHash==0||v.amount==0)revert InvalidInvoice();if(v.deadline<block.timestamp)revert ExpiredSignature();
  Head storage h=heads[v.scope][v.invoiceId];if(v.revision!=uint256(h.revision)+1||v.previousDigest!=h.digest)revert InvalidTransition();
  bytes32 digest=invoiceDigest(v);if(accepted[digest].signer!=address(0))revert InvalidTransition();address signer=ECDSA.recover(digest,sig);if(signer!=p.issuer)revert UnauthorizedSigner();
  Registration memory registered=_registration(org,label,p);
  (address route,,)=universal.findResolver(name);if(route!=resolver)revert ResolverChanged();
  uint256 currentId=IRegisteredRecordResolver(resolver).getRecordId(node);uint256 boundId=recordIds[v.scope][v.invoiceId];
  // Never write through an existing alias or seize a name's pre-existing bundle.
  if(h.revision==0){if(currentId!=0||boundId!=0)revert RecordConflict();}
  else if(currentId==0||currentId!=boundId)revert RecordConflict();
  h.digest=digest;h.revision=v.revision;accepted[digest]=Acceptance(v.scope,v.invoiceId,v.policyHash,signer,uint64(block.number));
  emit InvoiceRegistrationChecked(digest,registered.organizationRegistry,registered.invoiceRegistry,registered.namespaceResource,registered.invoiceResource,registered.organizationExpiry,registered.namespaceExpiry,registered.invoiceExpiry,p.controller,resolver);
  emit InvoiceAccepted(v.scope,v.invoiceId,digest,org,resolver,resolver.codehash,abi.encode(v),raw,sig);
  bytes memory value=pointer(v.scope,v.invoiceId);
  if(boundId==0){
   // Failure is deliberately propagated: ledger state and events roll back too.
   IRegisteredRecordResolver(resolver).setData(name,RECORD_KEY,value);
   boundId=IRegisteredRecordResolver(resolver).getRecordId(node);if(boundId==0)revert RecordConflict();recordIds[v.scope][v.invoiceId]=boundId;
   emit InvoiceRecordPublished(v.scope,v.invoiceId,name,resolver,boundId,value);
  }
  (bytes memory answer,address actual)=universal.resolveWithGateways(name,abi.encodeWithSignature("data(bytes32,string)",bytes32(0),RECORD_KEY),new string[](0));
  if(actual!=resolver||keccak256(abi.decode(answer,(bytes)))!=keccak256(value)||IRegisteredRecordResolver(resolver).getRecordId(node)!=boundId)revert RecordConflict();
 }
}
