import {inspectOrganization,preparePolicy} from '../src/policy.mjs';import {lookupPolicy} from '../src/ens.mjs';import {objectHash} from '../src/analysis.mjs';import * as p from '../src/protocol.mjs';
export class Setup {
 constructor({contexts,db=contexts.db,client,platform,identities,publicIdentities,guard=()=>{}}){Object.assign(this,{contexts,db,client,platform,publicIdentities:identities??publicIdentities,guard});}
 async identities(){return this.publicIdentities();}
 input(input){return{...input,client:this.client,chainId:this.platform.chainId,universal:this.platform.universal,registry:this.platform.registry};}
 async operator(input){const r=await inspectOrganization(this.input(input));return{...r,allowed:r.operator,role:p.eq(r.account,r.controller)?'organization-owner':r.canPublish?'agents-resolver-delegate':null};}
 async check(input){const c=await inspectOrganization(this.input(input)),keys=await this.identities();let reuse=null;
  if(c.raw!=='0x'){
   try{const policy=p.decodePolicy(c.raw),trust={chainId:c.chainId,org:c.org,label:c.label,controller:c.controller,ownershipResource:c.ownershipResource,resolver:c.resolver,generation:policy.generation,requester:keys.requester,receiver:keys.receiver,universal:c.universal,registry:c.registry,codeHashes:c.codeHashes,evidence:keys.evidence,runtimeCodeHash:keys.runtimeCodeHash,policyHash:p.hash(c.raw),recordId:c.recordId},checkpoint=await lookupPolicy({client:this.client,trust,blockNumber:c.blockNumber,allowExpired:true});
    this.guard();const existing=await this.contexts.add({trust,policy,raw:c.raw,publication:{publisher:null,transactionHash:null,receipt:null,checkpoint,nativeObserved:true},source:'independent-native-ENS'});reuse={contextId:existing.id,name:existing.name,validity:validity(policy,c.timestamp)};
   }catch(error){if(error.status)throw error;}
  }
  const canConfigure=c.canPublish&&c.recordId===0n&&c.raw==='0x';return{...c,keys,permission:c.canPublish,canConfigure,reuse,status:reuse?'known-configuration':canConfigure?'ready':c.raw!=='0x'||c.recordId>0n?'conflict':'permission-denied',message:reuse?'Existing native policy independently verified. Select this configuration; no ENS write is needed.':canConfigure?'Current resolver permission confirmed for a fresh agent name':'No matching trusted configuration or publication permission; existing records remain unchanged'};
 }
 async prepare(input){const identities=await this.identities(),checked=await this.check(input);p.need(checked.canConfigure,checked.message);const prepared=await preparePolicy({...this.input(input),...identities}),plan={schema:1,preparedAt:new Date().toISOString(),...prepared,checked,protectedRecords:[]};plan.id=objectHash(plan);this.guard();this.db.create('plan:'+plan.id,plan);return plan;}
 async plan(id){p.need(/^0x[0-9a-f]{64}$/.test(id),'Invalid policy plan');const plan=this.db.get('plan:'+id);p.need(plan,'Policy preview unavailable');const {id:stored,...core}=plan;p.need(stored===id&&objectHash(core)===id,'Policy preview integrity mismatch');return plan;}
 async current(profile){try{const checkpoint=await lookupPolicy({client:this.client,trust:profile.trust,allowExpired:true});return{status:validity(checkpoint.policy,BigInt(Math.floor(Date.now()/1000))),checkedAt:new Date().toISOString(),checkpoint};}catch{return{status:'unavailable',checkedAt:new Date().toISOString(),message:'Current native ENS verification is unavailable or changed. No authorization pass is assumed.'};}}
}
export const validity=(p,time)=>BigInt(p.validAfter)>BigInt(time)?'not-yet-valid':BigInt(p.validUntil)<=BigInt(time)?'expired':'valid';
