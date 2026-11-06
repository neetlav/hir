import {DurableObject} from 'cloudflare:workers';
import {chainDiagnostic} from './diagnostics.mjs';
import {withAuthorityFallback} from '../app/authority-reads.mjs';
import {createPublicClient,http} from 'viem';import {privateKeyToAccount} from 'viem/accounts';import OpenAI from 'openai';
import configuration from '../config/sepolia.json';import {evidenceBuild} from '../build/protocol.mjs';import html from '../public/index.html';
import {Repository,JobStore} from '../app/storage.mjs';import {Contexts} from '../app/contexts.mjs';import {Setup} from '../app/setup.mjs';import {Workspace} from '../app/service.mjs';import {WorkspaceWallet} from '../app/wallet.mjs';import {WorkspaceAccess,WalletSessions,AccessError} from '../app/access.mjs';import {runExchange} from '../app/runtime.mjs';import {verify} from '../src/verifier.mjs';import * as p from '../src/protocol.mjs';

export const platform={configuration,modelFetch:null};
export const json=p.json;
export function originFor(request,env){let origin;try{const u=new URL(env.HIR_AGENTS_ORIGIN);p.need(u.protocol==='https:'&&u.origin===env.HIR_AGENTS_ORIGIN&&/^hir-agents\.[a-z0-9-]+\.workers\.dev$/.test(u.hostname),'origin');origin=u.origin;}catch{throw new AccessError('Configure this Agents Worker’s exact HTTPS workers.dev origin',503);}if(new URL(request.url).origin!==origin||request.headers.has('Origin')&&request.headers.get('Origin')!==origin)throw new AccessError('Use the configured Agents origin');return origin;}
export const response=(body,status=200,headers={})=>new Response(p.json(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers}});
async function body(request){const reader=request.body?.getReader();if(!reader)return{};const chunks=[];let size=0;for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>1024*1024){await reader.cancel();throw new AccessError('Request exceeds 1 MB',413);}chunks.push(value);}const bytes=new Uint8Array(size);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.length;}return JSON.parse(new TextDecoder().decode(bytes));}
const routes=new Map([['workspace','GET'],['identities','GET'],['evidence','GET'],['trust','GET'],...['setup/check','setup/prepare','setup/registration-prepare','context/select','policy/check','wallet/intent','wallet/dispatched','wallet/result','wallet/confirm','wallet/retry','run','verify'].map(x=>[x,'POST'])]);
export class AgentsState extends DurableObject {
 constructor(ctx,env){super(ctx,env);this.env=env;this.db=new Repository(ctx.storage);const config=platform.configuration,client=url=>createPublicClient({transport:http(url,{timeout:12000,retryCount:0}),cacheTime:0,ccipRead:false});
  const defaultRPC='https://rpc.sepolia.ethpandaops.io',recoverableClient=(url,backup)=>{const primary=url||defaultRPC,fallback=backup||(primary.replace(/\/$/,'')===defaultRPC?'https://sepolia.gateway.tenderly.co':null),source=client(primary);return fallback?withAuthorityFallback(source,client(fallback)):source;};
  this.receiver=recoverableClient(env.HIR_AGENTS_RECEIVER_RPC,env.HIR_AGENTS_RECEIVER_FALLBACK_RPC);this.requester=recoverableClient(env.HIR_AGENTS_REQUESTER_RPC,env.HIR_AGENTS_REQUESTER_FALLBACK_RPC);
  const accounts=()=>{try{p.need(/^0x[0-9a-fA-F]{64}$/.test(env.HIR_AGENTS_REQUESTER_KEY??'')&&/^0x[0-9a-fA-F]{64}$/.test(env.HIR_AGENTS_RECEIVER_KEY??''),'keys');return{requester:privateKeyToAccount(env.HIR_AGENTS_REQUESTER_KEY),receiver:privateKeyToAccount(env.HIR_AGENTS_RECEIVER_KEY)};}catch{throw Error('Dedicated signer secret bindings are unavailable or invalid');}};
  const identities=async()=>{const a=accounts();p.need(!p.eq(a.requester.address,a.receiver.address),'Requester and receiver must be distinct dedicated identities');return{requester:a.requester.address,receiver:a.receiver.address,evidence:config.evidence,runtimeCodeHash:config.runtimeCodeHash};};
  const contexts=new Contexts(this.db,new JobStore(this.db)),setup=new Setup({contexts,client:this.receiver,platform:config,identities}),wallet=new WorkspaceWallet({contexts,setup,client:this.receiver,chainId:config.chainId,db:this.db,build:evidenceBuild});
  const run=async options=>{p.need(typeof env.OPENAI_API_KEY==='string'&&env.OPENAI_API_KEY.length>0,'Configure the model API secret binding before running agents');return runExchange({...options,accounts:accounts(),requesterClient:this.requester,receiverClient:this.receiver,openAIClient:new OpenAI({apiKey:env.OPENAI_API_KEY,maxRetries:0,timeout:30000,...(platform.modelFetch?{fetch:platform.modelFetch}:{})})});};
  this.workspace=new Workspace({contexts,setup,wallet,db:this.db,build:evidenceBuild,runtime:{current:new Map()},runExchange:run});
  const sessions=new WalletSessions({operator:input=>setup.operator(input),origin:env.HIR_AGENTS_ORIGIN,chainId:config.chainId});for(const row of this.db.list('session:')){const s=row.value;if(s.expires>Date.now()&&s.origin===env.HIR_AGENTS_ORIGIN)sessions.sessions.set(s.id,s);}sessions.save=s=>this.db.put('session:'+s.id,{...s,origin:env.HIR_AGENTS_ORIGIN});this.access=new WorkspaceAccess({workspace:this.workspace,sessions});
  const live=this.workspace.live;if(live?.active){const failed={...live,active:false,status:'indeterminate',error:'An earlier request was interrupted. Retained progress is available; it is never automatically restarted.'};this.workspace.live=failed;const key='run:'+live.actor.toLowerCase()+':'+live.runId,old=this.db.get(key);if(old)this.db.put(key,{...old,status:'indeterminate',error:failed.error});}
 }
 persist(){for(const s of this.access.sessions.sessions.values())this.access.sessions.save(s);}
 async fetch(request){let session,operation;try{
  const origin=originFor(request,this.env),url=new URL(request.url),route=url.pathname,sessions=this.access.sessions;session=sessions.fromCookie(request.headers.get('cookie')||'');
  if(['/','/setup','/policy','/interaction','/history'].includes(route)){
   if(request.method!=='GET')throw new AccessError('Read-only page route',405);if(route==='/')return new Response(null,{status:303,headers:{Location:'/setup'}});
   session??=sessions.create();this.persist();return new Response(html.replace('__TOKEN__',session.csrf),{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Set-Cookie':`hir_agents_session=${session.id}; Secure; HttpOnly; SameSite=Strict; Path=/; Max-Age=1800`}});
  }
  if(!route.startsWith('/api/'))throw new AccessError('Not found',404);const name=route.slice(5);operation=name;
  if(name==='stop')throw new AccessError('No public process-control API',404);
  if(!session)throw new AccessError('Open Agents and verify your wallet',401);
  if(request.headers.get('x-hir-agents-token')!==session.csrf)throw new AccessError('Reload this page to refresh its browser session',409);
  if(request.method==='POST'&&(request.headers.get('Origin')!==origin||!request.headers.get('Content-Type')?.startsWith('application/json')))throw new AccessError('Same-origin JSON request required');
  if(name==='auth/session'&&request.method==='GET')return response(sessions.public(session));
  if(name==='auth/organization'&&request.method==='POST')return response(await this.workspace.setup.organization(await body(request)));
  if(name==='auth/logout'&&request.method==='POST'){sessions.logout(session);return response({authenticated:false});}
  if(name==='auth/challenge'&&request.method==='POST')return response(sessions.challenge(session,await body(request)));
  if(name==='auth/verify'&&request.method==='POST'){const pending=sessions.verify(session,await body(request));this.persist();const result=await pending;this.persist();return response(result);}
  if(name==='public/verify'&&request.method==='POST'){const b=await body(request);p.need(b.trust&&b.bundle&&b.sealSignature,'Provide evidence and independently expected trust');return response(await verify({client:this.receiver,config:b.trust,build:evidenceBuild,bundle:b.bundle,sealSignature:b.sealSignature,anchor:b.anchor}));}
  if(routes.get(name)!==request.method)throw new AccessError('Unknown endpoint',404);
  const value=await this.access.execute(session,name,request.method==='POST'?await body(request):{},url.searchParams);this.persist();return response(value);
 }catch(error){this.persist();let diagnostic;if(!(error instanceof AccessError)||error.status===503&&error.cause){const event=chainDiagnostic(error,operation??'page');console.error('Agents chain check unavailable',JSON.stringify(event));diagnostic={id:event.id,operation:event.operation,category:event.category};}return response({error:error instanceof AccessError||error.constructor===Error?error.message:'The chain or service check could not complete. No successful action is assumed.',...(diagnostic?{diagnostic}:{})},error instanceof AccessError?error.status:400);}}
}
