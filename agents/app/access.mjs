import {randomBytes} from 'node:crypto';
import {getAddress,isAddress,recoverMessageAddress} from 'viem';
import {Setup} from './setup.mjs';
import {Workspace} from './service.mjs';
import {WorkspaceWallet} from './wallet.mjs';
import * as p from '../src/protocol.mjs';

export class AccessError extends Error {constructor(message,status=403){super(message);this.status=status;}}
const need=(ok,message,status)=>{if(!ok)throw new AccessError(message,status);};
export const unresolved=r=>['awaiting-wallet','wallet-dispatched','submitted','confirming'].includes(r.status);
const random=()=>randomBytes(32).toString('hex');

// An HTTP cookie identifies this browser session; it is never proof of wallet control.
export class WalletSessions {
 constructor({operator,origin,chainId=11155111,now=()=>Date.now(),ttl=30*60*1000}={}){Object.assign(this,{operator,origin,chainId,now,ttl});this.sessions=new Map();this.save=()=>{};}
 create(){for(const [id,s] of this.sessions)if(s.expires<=this.now())this.sessions.delete(id);need(this.sessions.size<256,'Too many local sessions; retry later',429);const s={id:random(),csrf:random(),epoch:0,expires:this.now()+this.ttl,account:null,org:null,contextId:null,challenge:null};this.sessions.set(s.id,s);this.save(s);return s;}
 fromCookie(cookie=''){const id=cookie.split(';').map(x=>x.trim()).find(x=>x.startsWith('hir_agents_session='))?.slice('hir_agents_session='.length),s=this.sessions.get(id);if(!s||s.expires<=this.now()){if(s)this.sessions.delete(id);return null;}return s;}
 logout(s){if(!s)return;s.epoch++;s.account=null;s.org=null;s.contextId=null;s.challenge=null;s.authority=null;this.save(s);}
 guard(s){const epoch=s?.epoch;return()=>need(s&&this.sessions.get(s.id)===s&&s.account&&s.org&&s.expires>this.now()&&s.epoch===epoch,'Verify your wallet and organization to enter this workspace',401);}
 challenge(s,{account,org,chainId}){
  need(s&&s.expires>this.now(),'Reload the local Agents page',401);this.logout(s);
  need(isAddress(account??'')&&!p.eq(account,'0x0000000000000000000000000000000000000000'),'Choose a wallet address',400);need(chainId===this.chainId,'Choose Ethereum Sepolia before verification',400);p.names(org);
  const issued=this.now(),expires=issued+120000,nonce=random(),address=getAddress(account);
  const message=`${this.origin} wants you to sign in with your Ethereum account:\n${address}\n\nAuthorize HIR Agents workspace access for existing organization ${org}. No transaction or policy change.\n\nURI: ${this.origin}/setup\nVersion: 1\nChain ID: ${this.chainId}\nNonce: ${nonce}\nIssued At: ${new Date(issued).toISOString()}\nExpiration Time: ${new Date(expires).toISOString()}\nResources:\n- urn:hir:agents:${org}`;
  s.challenge={message,account:address,org,expires,epoch:s.epoch};this.save(s);return{message,expiresAt:new Date(expires).toISOString()};
 }
 async verify(s,{signature}){
  const c=s?.challenge;if(s){s.challenge=null;this.save(s);}need(c&&c.expires>this.now()&&c.epoch===s.epoch,'Wallet challenge expired or already used',401);
  let signer;try{signer=await recoverMessageAddress({message:c.message,signature});}catch{throw new AccessError('Wallet signature did not authenticate this request',401);}
  need(p.eq(signer,c.account),'Wallet signature does not match the challenged account',401);
  let authority;try{authority=await this.operator({org:c.org,account:c.account});}catch{throw new AccessError('Current ENS operator verification is unavailable; no access was granted',503);}
  need(c.epoch===s.epoch&&s.expires>this.now(),'Wallet challenge was invalidated',401);need(authority.allowed,'This wallet is not a current organization owner or Agents resolver delegate',403);
  s.account=c.account;s.org=c.org;s.contextId=null;s.authority=authority;s.expires=this.now()+this.ttl;this.save(s);return this.public(s);
 }
 public(s){return{authenticated:Boolean(s?.account&&s.expires>this.now()),account:s?.account??null,org:s?.org??null,contextId:s?.contextId??null,expiresAt:s?.account?new Date(s.expires).toISOString():null};}
 async require(s){const guard=this.guard(s);guard();let authority;try{authority=await this.operator({org:s.org,account:s.account});}catch{this.logout(s);throw new AccessError('Current ENS operator verification is unavailable. Verify your wallet again when it recovers.',503);}guard();if(!authority.allowed){this.logout(s);throw new AccessError('Current ENS operator permission was removed',403);}s.authority=authority;return guard;}
}

// These adapters never read or write the preserved global selection.json.
export class SessionContexts {
 constructor(base,session,guard){Object.assign(this,{base,session,guard,root:base.root,store:base.store});}
 async list(){this.guard();return(await this.base.list()).filter(x=>x.trust.org===this.session.org);}
 async get(id){this.guard();const profile=await this.base.get(id);this.guard();need(profile.trust.org===this.session.org,'Identity is outside the authenticated organization');return profile;}
 async selected(expected){this.guard();const id=this.session.contextId;need(id,'Select an agent identity explicitly',409);need(expected===undefined||expected===id,'Selected identity differs from this request',409);const profile=await this.get(id);need(this.session.contextId===id,'Selected identity changed during this request',409);return profile;}
 async select(id){const profile=await this.get(id);this.guard();this.session.contextId=profile.id;return profile;}
 async add(input){this.guard();need(input.trust.org===this.session.org,'Policy is outside the authenticated organization');return this.base.add(input);}
 async jobs(profile){await this.get(profile.id);return this.base.jobs(profile);}
 async job(profile,id){await this.get(profile.id);return this.base.job(profile,id);}
}

export class WorkspaceAccess {
 constructor({workspace=new Workspace(),sessions,origin,chainId}={}){this.workspace=workspace;this.sessions=sessions??new WalletSessions({operator:input=>workspace.setup.operator(input),origin,chainId});}
 scope(session,guard){
  const base=this.workspace,contexts=new SessionContexts(base.contexts,session,guard),setup=new Setup({...base.setup,contexts,guard});
  const wallet=new WorkspaceWallet({contexts,setup,client:base.wallet.client,chainId:base.wallet.chainId,gate:base.wallet.gate,db:base.db,build:base.build,guard});
  const scoped=new Workspace({contexts,setup,wallet,runtime:base.runtime,db:base.db,build:base.build,guard,actor:session.account,runExchange:async options=>base.executeRuntime({...options,guard:async()=>{await this.sessions.require(session);guard();options.lease();}}),walletView:state=>this.walletView(session,state)});
  return scoped;
 }
 async rowOrg(row){if(row.operation==='policy')return(await this.workspace.setup.plan(row.planId)).trust.org;if(row.operation==='anchor')return(await this.workspace.contexts.get(row.contextId)).trust.org;return null;}
 async ownsRow(s,row){return Boolean(row&&p.eq(row.transaction?.from,s.account)&&await this.rowOrg(row)===s.org);}
 async walletView(s,state){const operations={};for(const [key,row] of Object.entries(state.operations))if(await this.ownsRow(s,row))operations[key]=row;return{operations};}
 input(s,body){need(body.org===undefined||body.org===s.org,'Organization differs from the authenticated session');need(body.account===undefined||p.eq(body.account,s.account),'Account differs from the verified wallet');return{...body,org:s.org,account:s.account};}
 async plan(s,id){const plan=await this.workspace.setup.plan(id);need(plan.trust.org===s.org&&p.eq(plan.transaction.from,s.account),'Preview is outside this wallet and organization');return plan;}
 selected(s,id){need(s.contextId&&id===s.contextId,'Select the requested agent in this browser session',409);}
 async execute(s,route,body={},query=new URLSearchParams()){
  this.workspace.reconcile();
  const sessionGuard=await this.sessions.require(s);let expectedContext=null;
  const guard=()=>{sessionGuard();if(expectedContext)need(s.contextId===expectedContext,'Selected identity changed during this request',409);},w=this.scope(s,guard);let result;
  const selected=id=>{this.selected(s,id);expectedContext=id;};
  switch(route){
   case'workspace':result={...await w.status(),session:this.sessions.public(s)};break;
   case'identities':result=await w.setup.identities();break;
   case'setup/check':result=await w.setup.check(this.input(s,body));break;
   case'setup/prepare':p.need(!w.live?.active,'Wait for the active exchange');result=await w.setup.prepare(this.input(s,body));break;
   case'context/select':result=await w.select(body.contextId);break;
   case'policy/check':selected(body.contextId);result=await w.checkPolicy(body.contextId);break;
   case'run':selected(body.contextId);this.input(s,body);result=await w.run(body);break;
   case'verify':selected(body.contextId);result=await w.verify(body.contextId,body.id);break;
   case'evidence':selected(query.get('contextId'));result=await w.download(query.get('contextId'),query.get('id'));break;
   case'trust':selected(query.get('contextId'));result=(await w.contexts.selected(query.get('contextId'))).trust;break;
   case'wallet/intent':{
    const input=this.input(s,body);if(body.operation==='policy')await this.plan(s,body.planId);else{need(body.operation==='anchor','Unsupported wallet operation',400);selected(body.contextId);await w.contexts.selected(body.contextId);}p.need(!w.live?.active,'Wait for the active exchange');result=await w.wallet.intent(input);break;
   }
   case'wallet/dispatched':case'wallet/result':case'wallet/confirm':{
    const row=(await w.wallet.state()).operations[body.key];need(await this.ownsRow(s,row),'Wallet request is outside this signer and organization');
    if(row.operation==='anchor')selected(row.contextId);
    if(route==='wallet/dispatched')result=await w.wallet.dispatch(body.key);else if(route==='wallet/result')result=await w.wallet.result(body);else result=await w.wallet.confirm(body.key);break;
   }
   default:throw new AccessError('Unknown Agents endpoint',404);
  }
  guard();return result;
 }
}
