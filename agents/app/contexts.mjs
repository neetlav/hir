import {objectHash} from '../src/analysis.mjs';import * as p from '../src/protocol.mjs';
export function belongs(profile,state){const r=state?.envelope?.request,t=profile.trust;return Boolean(r&&p.eq(r.agentNode,p.names(t.org,t.label).agentNode)&&p.eq(r.requester,t.requester)&&p.eq(r.receiver,t.receiver)&&p.eq(r.generation,t.generation)&&p.eq(r.policyHash,profile.policyHash)&&(!state.sealed||(p.eq(state.sealed.bundle.evidence,t.evidence)&&Number(state.sealed.bundle.chainId)===Number(t.chainId)&&state.sealed.bundle.org===t.org)));}
export class Contexts {
 constructor(db,store){Object.assign(this,{db,store});}
 async list(){return this.db.list('context:').map(r=>r.value);}
 async get(id){p.need(/^0x[0-9a-f]{64}$/.test(id),'Invalid trusted context');const c=this.db.get('context:'+id);p.need(c,'Trusted identity unavailable');const core={...c.trust};delete core.contextId;p.need(objectHash(core)===id&&p.eq(p.hash(c.raw),c.policyHash)&&p.eq(p.encodePolicy(c.policy),c.raw),'Trusted policy integrity mismatch');return c;}
 async add({trust,policy,raw,publication,protectedRecords=[],source}){const core={...trust,label:trust.label??'requester',policyHash:p.hash(raw)};delete core.contextId;const id=objectHash(core),before=this.db.get('context:'+id);if(before)return this.get(id);const c={id,name:p.names(core.org,core.label).agent,policyHash:p.hash(raw),trust:{...core,contextId:id},policy,raw,publication,protectedRecords,source,createdAt:new Date().toISOString()};return this.db.transaction(()=>this.db.create('context:'+id,c));}
 async jobs(profile){const jobs=[];for(const id of await this.store.ids()){const state=await this.store.load(id);if(belongs(profile,state))jobs.push({id,state});}return jobs.sort((a,b)=>Number(BigInt(b.state.envelope.request.createdAt)-BigInt(a.state.envelope.request.createdAt)));}
 async job(profile,id){const state=await this.store.load(id);p.need(belongs(profile,state),'Record is outside selected trusted context');return state;}
}
