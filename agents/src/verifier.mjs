import {recoverTypedDataAddress,encodeAbiParameters} from 'viem';
import {authenticateEvent} from '../../scripts/shared/chain-evidence.mjs';
import {lookupPolicy} from './ens.mjs';import {authenticateRequest} from './engine.mjs';import {objectHash,canonical,analyze} from './analysis.mjs';import * as p from './protocol.mjs';
export async function verify({client,config,build,bundle,sealSignature,anchor,lookup=lookupPolicy}){
 const result={status:'unavailable',authenticity:'unchecked',authority:'unavailable',assessment:'unavailable',receiverDecision:'unchecked',execution:'unchecked',anchoring:anchor?'unchecked':'pending',violation:false,limits:'Signatures and anchors authenticate statements and commitments, not hidden execution, non-execution, complete logging or uninterrupted ENS ownership.'};
 try{
  p.need(bundle.schema==='hir-agents-evidence-v1'&&Number(bundle.chainId)===Number(config.chainId)&&p.eq(bundle.evidence,config.evidence)&&bundle.org===config.org,'Wrong bundle domain');
  const r=await authenticateRequest({config,...bundle.envelope}),d=p.hydrate(bundle.decision,p.decisionFields),o=p.hydrate(bundle.outcome,p.outcomeFields);
  for(const [type,message,signature] of [['Decision',d,bundle.decisionSignature],['Outcome',o,bundle.outcomeSignature]])p.need(p.eq(await recoverTypedDataAddress({...p.typed(config,type,message),signature}),config.receiver),'Wrong '+type+' signer/domain');
  p.need(p.eq(d.requestId,r.requestId)&&p.eq(o.requestId,r.requestId)&&p.eq(d.requestDigest,p.digest(config,'Request',r))&&p.eq(o.decisionDigest,p.digest(config,'Decision',d)),'Request/decision/outcome linkage mismatch');
  p.need(p.eq(d.policyHash,r.policyHash)&&p.eq(d.reasonHash,p.textHash(bundle.reason)),'Policy or public decision reason altered');
  p.need(Number(d.assessed)<=2&&Number(o.status)<=3&&(d.accepted?Number(o.status)!==0:Number(o.status)===0),'Inconsistent receiver outcome');
  p.need(o.completedAt>=d.decidedAt&&p.eq(o.outputHash,objectHash(bundle.output)),'Outcome bytes or timing mismatch');
  const seal={requestDigest:p.digest(config,'Request',r),decisionDigest:p.digest(config,'Decision',d),outcomeDigest:p.digest(config,'Outcome',o),bundleHash:objectHash(bundle)};
  p.need(p.eq(await recoverTypedDataAddress({...p.typed(config,'Seal',seal),signature:sealSignature}),config.receiver),'Bundle seal signature mismatch');
  result.authenticity='pass';result.receiverDecision=d.accepted?'accepted':'rejected';
  let checkpoint;
  if(d.checkpointHash!==p.zeroHash){
   try{checkpoint=await lookup({client,trust:config,blockNumber:d.checkpointNumber,checkpointHash:d.checkpointHash});}
   catch{result.authority='unavailable';result.message='Historical native ENS checkpoint unavailable or mismatched; authority has not passed';}
  }
  if(checkpoint){
   p.need(p.eq(checkpoint.raw,bundle.assessment.checkpoint.raw)&&p.eq(checkpoint.policyHash,r.policyHash),'Offchain policy bytes/hash differ from authoritative historical ENS');
   p.need(p.eq(checkpoint.blockHash,d.checkpointHash)&&BigInt(checkpoint.blockNumber)===d.checkpointNumber,'Historical checkpoint mismatch');
   const timeValid=r.createdAt<=BigInt(checkpoint.timestamp)+60n&&d.decidedAt>=r.createdAt&&d.decidedAt<r.expiresAt&&d.decidedAt>=BigInt(checkpoint.timestamp)&&d.decidedAt-BigInt(checkpoint.timestamp)<=300n&&d.decidedAt<BigInt(checkpoint.policy.validUntil);
   const assessed=timeValid?(p.price(Number(r.mode))<=Number(checkpoint.policy.maxCredits)?0:1):2;
   p.need(Number(d.assessed)===assessed&&Number(bundle.assessment.code)===assessed,'Signed deterministic assessment is incorrect');
   result.authority=assessed===0?'within-authority':assessed===1?'outside-authority':'unavailable-denied';result.assessment=assessed===0?'pass':assessed===1?'cap-exceeded':'invalid-timing';
   result.policy={raw:checkpoint.raw,hash:checkpoint.policyHash,blockNumber:checkpoint.blockNumber,blockHash:checkpoint.blockHash};
  }
  result.violation=d.accepted&&(result.authority!=='within-authority');
  if(Number(o.status)===1){p.need(canonical(bundle.output)===canonical(analyze(bundle.envelope.input,Number(r.mode))),'Recomputed analysis result differs');result.execution='completed-result-recomputed';}
  else result.execution=['receiver-reports-not-executed',null,'receiver-reports-failed','indeterminate'][Number(o.status)];
  if(anchor){
   const snapshot=await client.getBlock(),eventABI=build.abi.find(x=>x.type==='event'&&x.name==='EvidenceRecorded');
   const {event,receipt}=await authenticateEvent({client,address:config.evidence,runtimeCodeHash:build.runtimeCodeHash,abi:build.abi,eventABI,bundle:anchor,snapshot});
   p.need(snapshot.number>=receipt.blockNumber+1n,'Anchor needs two observed confirmations');
   const rd=p.digest(config,'Request',r),dd=p.digest(config,'Decision',d),od=p.digest(config,'Outcome',o),bh=objectHash(bundle),key=p.hash(encodeAbiParameters([{type:'address'},{type:'bytes32'}],[r.requester,r.requestId]));
   for(const [k,v] of Object.entries({key,requestDigest:rd,decisionDigest:dd,outcomeDigest:od,bundleHash:bh,requester:r.requester,receiver:r.receiver,accepted:d.accepted,assessed:d.assessed,status:o.status}))p.need(p.eq(event[k],v),'Anchor commitment mismatch: '+k);
   const stored=await client.readContract({address:config.evidence,abi:build.abi,functionName:'recorded',args:[key],blockNumber:receipt.blockNumber});p.need(p.eq(stored,p.hash(encodeAbiParameters([{type:'bytes32'},{type:'bytes32'},{type:'bytes32'},{type:'bytes32'}],[rd,dd,od,bh]))),'Anchor storage mismatch');
   result.anchoring='confirmed';result.transactionHash=anchor.transactionHash;result.anchorBlock=receipt.blockNumber;
  }
  result.status=result.authority==='unavailable'?'unavailable':anchor?'verified':'pending-anchor';
 }catch(error){result.status='fail';result.message=error.constructor===Error?error.message:'Chain evidence or signature check could not complete';}
 return result;
}
