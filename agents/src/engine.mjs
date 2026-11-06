import {randomBytes} from 'node:crypto';import {recoverTypedDataAddress} from 'viem';
import * as p from './protocol.mjs';import {canonical,objectHash,analyze,validateInput} from './analysis.mjs';import {lookupPolicy} from './ens.mjs';
export const now=()=>BigInt(Math.floor(Date.now()/1000));
const equalObject=(a,b)=>canonical(a)===canonical(b);
export async function authenticateRequest({config,request,signature,input}){
 validateInput(input);const r=p.hydrate(request,p.requestFields);
 p.need(p.eq(await recoverTypedDataAddress({...p.typed(config,'Request',r),signature}),config.requester),'Wrong requester signature or domain');
 for(const [key,expected] of Object.entries({requester:config.requester,receiver:config.receiver,agentNode:p.names(config.org,config.label??'requester').agentNode,action:p.ACTION,generation:config.generation,priceTable:p.TABLE}))p.need(p.eq(r[key],expected),'Wrong request '+key);
 if(config.policyHash)p.need(p.eq(r.policyHash,config.policyHash),'Wrong request policy for selected context');
 const mode=Number(r.mode);p.need(r.credits===BigInt(p.price(mode))&&p.eq(r.parametersHash,p.parametersHash(mode)),'Price must match signed parameters and fixed catalogue');
 p.need(p.eq(r.inputHash,objectHash(input)),'Input hash mismatch');p.need(r.requestId!==p.zeroHash&&r.createdAt<r.expiresAt&&r.expiresAt-r.createdAt<=600n,'Invalid request identity/validity');
 return r;
}
export async function signRequest({config,account,policy,input,mode,requestId='0x'+randomBytes(32).toString('hex'),time=now()}){
 validateInput(input);const request={requestId,agentNode:p.names(config.org,config.label??'requester').agentNode,requester:account.address,receiver:config.receiver,action:p.ACTION,inputHash:objectHash(input),parametersHash:p.parametersHash(mode),mode,priceTable:p.TABLE,credits:p.price(mode),policyHash:policy.policyHash,generation:config.generation,createdAt:time,expiresAt:time+600n};
 return{request,signature:await account.signTypedData(p.typed(config,'Request',request)),input};
}
export async function assess({config,client,request,signature,input,lookup=lookupPolicy}){
 const r=await authenticateRequest({config,request,signature,input});
 try{
  const checkpoint=await lookup({client,trust:config});
  p.need(p.eq(r.policyHash,checkpoint.policyHash),'Signed policy differs from independently resolved policy');
  p.need(r.createdAt<=checkpoint.timestamp+60n&&r.expiresAt>checkpoint.timestamp&&r.createdAt<=now()+5n&&r.expiresAt>now(),'Request expired or not yet valid');
  p.need(checkpoint.timestamp>=now()-300n,'Policy checkpoint too old for a live decision');
  const compliant=r.credits<=BigInt(checkpoint.policy.maxCredits);
  return{code:compliant?0:1,status:compliant?'within-authority':'outside-authority',derivedCredits:p.price(Number(r.mode)),cap:50,checkpoint,reason:compliant?'Fixed catalogue price is within 50 credits per request':'Fixed catalogue price exceeds 50 credits per request'};
 }catch(error){return{code:2,status:'unavailable-denied',derivedCredits:p.price(Number(r.mode)),cap:50,reason:error.constructor===Error?error.message:'Native ENS RPC or policy unavailable; authorization denied'};}
}
export class Engine {
 constructor({config,client,account,store,clock=now,lookup=lookupPolicy}){Object.assign(this,{config,client,account,store,clock,lookup});this.busy=new Set();}
 async serial(id,fn){p.need(!this.busy.has(id),'Request already active');this.busy.add(id);try{return await fn();}finally{this.busy.delete(id);}}
 async receive(envelope){const request=await authenticateRequest({config:this.config,...envelope});return this.serial(request.requestId,async()=>{const previous=await this.store.load(request.requestId);if(previous){p.need(p.eq(p.digest(this.config,'Request',p.hydrate(previous.envelope.request,p.requestFields)),p.digest(this.config,'Request',request))&&equalObject(previous.envelope.input,envelope.input),'Request ID replay conflict');return previous;}return this.store.append(request.requestId,{version:1,phase:'received',envelope,activity:[],receivedAt:this.clock()});});}
 async evaluate(id){return this.serial(id,async()=>{const state=await this.store.load(id);p.need(state,'Unknown request');if(state.decision||state.assessment)return state;state.assessment=await assess({config:this.config,client:this.client,...state.envelope,lookup:this.lookup});state.phase='assessed';return this.store.append(id,state);});}
 async decide(id,accepted,reason){return this.serial(id,async()=>{const state=await this.store.load(id);p.need(state?.assessment,'Independent assessment tool must run before decision');p.need(typeof accepted==='boolean'&&typeof reason==='string'&&reason.length>0&&reason.length<=500,'Decision and public reason required');if(state.decision){p.need(state.decision.accepted===accepted&&state.reason===reason,'Decision already frozen');return state;}
  const time=this.clock(),c=state.assessment.checkpoint;
  if(c)p.need(time>=BigInt(c.timestamp)&&time-BigInt(c.timestamp)<=300n,'Policy checkpoint too old; no decision recorded');
  const r=p.hydrate(state.envelope.request,p.requestFields);
  if(time<r.createdAt||time>=r.expiresAt||(c&&time>=BigInt(c.policy.validUntil))){state.assessment.code=2;state.assessment.status='unavailable-denied';state.assessment.reason='Request or policy not valid at decision time';}
  const decision={requestId:id,requestDigest:p.digest(this.config,'Request',p.hydrate(state.envelope.request,p.requestFields)),policyHash:state.envelope.request.policyHash,checkpointHash:c?.blockHash??p.zeroHash,checkpointNumber:BigInt(c?.blockNumber??0),assessed:state.assessment.code,accepted,reasonHash:p.textHash(reason),decidedAt:time};
  state.decision=decision;state.reason=reason;state.decisionSignature=await this.account.signTypedData(p.typed(this.config,'Decision',decision));state.violation=accepted&&state.assessment.code!==0;state.phase=accepted?'accepted':'rejected';await this.store.append(id,state);
  if(!accepted)return this.finish(state,0,null);return state;
 });}
 async finish(state,status,output){const outcome={requestId:state.envelope.request.requestId,decisionDigest:p.digest(this.config,'Decision',p.hydrate(state.decision,p.decisionFields)),status,outputHash:objectHash(output),completedAt:this.clock()};state.outcome=outcome;state.output=output;state.outcomeSignature=await this.account.signTypedData(p.typed(this.config,'Outcome',outcome));state.phase=['rejected','completed','failed','indeterminate'][status];return this.store.append(outcome.requestId,state);}
 async execute(id){return this.serial(id,async()=>{const state=await this.store.load(id);p.need(state?.decision?.accepted,'Receiver has not accepted');if(state.outcome)return state;
  if(state.phase==='executing')return this.finish(state,3,{message:'Execution was interrupted; no automatic rerun. Hidden execution cannot be established.'});
  await this.store.claim(id);state.phase='executing';await this.store.append(id,state); // Durable intent BEFORE computation.
  const output=analyze(state.envelope.input,Number(state.envelope.request.mode));return this.finish(state,1,output);
 });}
 async activity(id,event){return this.serial(id,async()=>{const state=await this.store.load(id);p.need(state,'Unknown request');p.need(!state.sealed,'Bundle already sealed');state.activity.push(event);return this.store.append(id,state);});}
 async seal(id,run){return this.serial(id,async()=>{const state=await this.store.load(id);p.need(state?.outcome,'No signed outcome to seal');if(state.sealed)return state;
  const bundle={schema:'hir-agents-evidence-v1',chainId:this.config.chainId,evidence:this.config.evidence,org:this.config.org,envelope:state.envelope,assessment:state.assessment,decision:state.decision,decisionSignature:state.decisionSignature,reason:state.reason,outcome:state.outcome,outcomeSignature:state.outcomeSignature,output:state.output,activity:state.activity,run};
  const bundleHash=objectHash(bundle),seal={requestDigest:p.digest(this.config,'Request',p.hydrate(state.envelope.request,p.requestFields)),decisionDigest:p.digest(this.config,'Decision',p.hydrate(state.decision,p.decisionFields)),outcomeDigest:p.digest(this.config,'Outcome',p.hydrate(state.outcome,p.outcomeFields)),bundleHash};
  state.sealed={bundle,bundleHash,sealSignature:await this.account.signTypedData(p.typed(this.config,'Seal',seal))};state.anchoring={status:'pending'};return this.store.append(id,state);
 });}
}
