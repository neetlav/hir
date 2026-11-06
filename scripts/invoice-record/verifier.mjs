import {recoverTypedDataAddress} from 'viem';
import {authenticateEvent,equal as eq,Mismatch,requireMatch as need} from '../shared/chain-evidence.mjs';
import * as p from './protocol.mjs';
export async function verifyInvoice({client,abi,anchor,bundle,documentBytes}){
 const out={kind:'HIR-invoice-only-verification',safeToPay:'notAssessed',ownershipContinuity:'notProvenByCurrentBinding',findings:{}};const f=out.findings;
 const pass=(key,code,extra={})=>f[key]={status:'pass',code,...extra};
 try{
  need(client?.ccipRead===false,'nativeOnchainClientRequired');need(anchor?.expectedOrg===p.organization(anchor?.expectedOrg),'independentExpectedSupplierRequired');
  need(await client.getChainId()===Number(anchor.chainId),'wrongChain');const snapshot=await client.getBlock();
  need(eq(p.hash(await client.getCode({address:anchor.ledger,blockNumber:snapshot.number})),anchor.runtimeCodeHash),'currentEvidenceCodeMismatch');
  const eventABI=abi.find(x=>x.type==='event'&&x.name==='InvoiceAccepted');const proof=await authenticateEvent({client,address:anchor.ledger,runtimeCodeHash:anchor.runtimeCodeHash,abi,eventABI,bundle,snapshot});
  const e=proof.event,v=p.decodeInvoice(e.invoiceData),policy=p.decodePolicy(e.policyData);
  need(eq(e.orgName,p.wire(anchor.expectedOrg))&&eq(policy.namespace,p.namespaceNode(anchor.expectedOrg)),'wrongExpectedSupplier');pass('expectedSupplier','independentlySelectedSupplierMatches');
  need(eq(policy.ledger,anchor.ledger)&&Number(policy.chainId)===Number(anchor.chainId),'policyDomainMismatch');need(eq(policy.resolver,e.resolver),'historicalResolverMismatch');
  need(eq(p.hash(e.policyData),v.policyHash)&&eq(p.scope(policy),v.scope)&&eq(e.scope,v.scope)&&eq(e.invoiceId,v.invoiceId),'policyOrScopeMismatch');
  need(eq(p.digest(anchor.ledger,anchor.chainId,v),e.digest),'signedDigestMismatch');
  const signer=await recoverTypedDataAddress({...p.typedInvoice(anchor.ledger,anchor.chainId,v),signature:e.signature});need(eq(signer,policy.issuer),'unauthorizedSigner');need(!eq(signer,policy.controller),'billingAndAdminMustDiffer');
  need(eq(v.recipient,policy.recipient)&&eq(v.token,policy.token)&&v.paymentChainId===policy.paymentChainId,'unapprovedHistoricalDestination');
  const record=await client.readContract({address:anchor.ledger,abi,functionName:'accepted',args:[e.digest],blockNumber:proof.receipt.blockNumber});
  need(eq(record[0],v.scope)&&eq(record[1],v.invoiceId)&&eq(record[2],v.policyHash)&&eq(record[3],signer)&&record[4]===proof.receipt.blockNumber,'acceptanceStorageMismatch');
  pass('historicalAuthenticity','authorizedAtLedgerAcceptance',{signer,controller:policy.controller,resolver:e.resolver,policyHash:v.policyHash});
  if(documentBytes!==undefined)f.documentIntegrity={status:eq(p.hash(documentBytes),v.pdfHash)?'pass':'fail',code:eq(p.hash(documentBytes),v.pdfHash)?'finalPDFMatches':'receivedPDFChanged'};else f.documentIntegrity={status:'unknown',code:'receivedPDFNotProvided'};
  const head=await client.readContract({address:anchor.ledger,abi,functionName:'heads',args:[v.scope,v.invoiceId],blockNumber:snapshot.number});
  f.currentRevision={status:eq(head[0],e.digest)?'pass':'fail',code:eq(head[0],e.digest)?'currentRevision':'superseded',revision:head[1]};
  try{
   const [current]=await client.readContract({address:anchor.ledger,abi,functionName:'readPolicy',args:[p.wire(anchor.expectedOrg)],blockNumber:snapshot.number});
   const matches=eq(p.scope(current),v.scope);f.currentIdentity={status:matches?'pass':'fail',code:matches?'currentBindingMatches':'identityBindingChanged'};
   f.currentPolicy={status:'pass',code:eq(p.hash(p.encodePolicy(current)),v.policyHash)?'unchanged':'changedSincePublication'};
   const destination=eq(v.token,current.token)&&eq(v.recipient,current.recipient)&&v.paymentChainId===current.paymentChainId;
   f.currentDestination={status:matches&&destination?'pass':'fail',code:matches&&destination?'currentlyApproved':'notCurrentlyApprovedForHistoricalIdentity'};
  }catch(error){const reverted=error.walk?.(e=>e.name==='ContractFunctionRevertedError');f.currentIdentity={status:reverted?'fail':'unknown',code:reverted?'currentENSBindingOrPolicyInvalid':'currentENSReadUnavailable'};f.currentPolicy={status:'unknown',code:'currentPolicyUnavailable'};f.currentDestination={status:'unknown',code:'currentApprovalUnavailable'};}
  out.acceptance={transactionHash:proof.receipt.transactionHash,logIndex:proof.log.logIndex,blockNumber:proof.receipt.blockNumber,blockHash:proof.receipt.blockHash,digest:e.digest};
  out.invoice=v;out.checkedAt={blockNumber:snapshot.number,blockHash:snapshot.hash};out.reference={namespace:p.namespace(anchor.expectedOrg),invoiceId:v.invoiceId,independentENSLeafRecord:false};
 }catch(error){f.verification={status:error instanceof Mismatch?'fail':'unknown',code:error instanceof Mismatch?error.message:'rpcOrEvidenceUnavailable'};}
 return out;
}
