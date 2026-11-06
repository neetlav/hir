import {requestReads} from '../app/customer/operation.mjs';
import manifest from '../config/registered-ledger-deployment.json';
import {ledgerDeploymentStatus} from '../app/customer/ledger-deployment.mjs';
import {DurableObject} from 'cloudflare:workers';
import {createPublicClient,http} from 'viem';import {sepolia} from 'viem/chains';
import {InvoiceAccess} from '../app/customer/access.mjs';import {createInvoiceService,invoiceDraftView} from '../app/customer/service.mjs';import {createPDF} from '../app/customer/pdf.mjs';import {fontBytes} from './fonts.mjs';
import config from '../config/registered-sepolia.json';import abi from '../config/registered-invoice-ledger-abi.json';import resolverABI from '../config/resolver-abi.json';import universalABI from '../config/universal-abi.json';
import {verifyReceived} from '../app/customer/verification.mjs';
export const platform={...config,abi,resolverABI,universalABI,cancellationSupported:false};
export const json=value=>JSON.stringify(value,(_,v)=>typeof v==='bigint'?v.toString():v);
async function readBody(request){const reader=request.body?.getReader();if(!reader)return{};const chunks=[];let size=0;for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>8*1024*1024){await reader.cancel();throw Object.assign(Error('Choose a PDF up to 5 MB'),{status:413});}chunks.push(Buffer.from(value));}return JSON.parse(Buffer.concat(chunks).toString('utf8'));}
export function originFor(request,env){let origin;try{const u=new URL(env.HIR_PUBLIC_ORIGIN);if(u.protocol!=='https:'||u.origin!==env.HIR_PUBLIC_ORIGIN||!/^hir-invoice\.[a-z0-9-]+\.workers\.dev$/.test(u.hostname))throw Error();origin=u.origin;}catch{throw Object.assign(Error('Set HIR_PUBLIC_ORIGIN to this Worker’s exact HTTPS workers.dev origin.'),{status:503});}if(new URL(request.url).origin!==origin||request.headers.has('Origin')&&request.headers.get('Origin')!==origin)throw Object.assign(Error('Use the configured HIR origin.'),{status:403});return origin;}
export function response(value,status=200,headers={}){return new Response(json(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});}
function readFailure(error){const chain=[];for(let cause=error;cause&&!chain.includes(cause);cause=cause.cause)chain.push(cause);if(chain.some(c=>/too many subrequests/i.test(c.message||'')))return{code:'rpcReadLimitExceeded',error:'This blockchain read exceeded the request limit. Your setup and pending transactions are preserved.'};if(chain.some(c=>['HttpRequestError','TimeoutError','SocketClosedError'].includes(c.name)))return{code:'rpcReadUnavailable',error:'The blockchain connection is temporarily unavailable. Please try again. Your setup and pending transactions are preserved.'};}
function repository(ctx){
 const sql=ctx.storage.sql;sql.exec('CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL)');sql.exec('CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, expires INTEGER NOT NULL, value TEXT NOT NULL)');
 const state={version:1,drafts:[],setups:[]},cache=new Map();for(const row of sql.exec('SELECT key,value FROM metadata')){cache.set(row.key,row.value);if(row.key.startsWith('draft:'))state.drafts.push(JSON.parse(row.value));else if(row.key.startsWith('setup:'))state.setups.push(JSON.parse(row.value));}
 return{state,async load(){return state;},async save(next){const updates=[];for(const [kind,records]of [['draft',next.drafts],['setup',next.setups]])for(const record of records){const text=json(record);if(/"(?:pdfFile|pdfBase64|previewBase64|documentBytes)"\s*:/.test(text))throw Error('PDF persistence is forbidden');const key=kind+':'+record.id;if(cache.get(key)!==text)updates.push([key,text]);}ctx.storage.transactionSync(()=>{for(const [key,value]of updates)sql.exec('INSERT INTO metadata(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',key,value);});for(const [key,text]of updates)cache.set(key,text);},sql};
}
export class InvoiceState extends DurableObject{
 constructor(ctx,env){super(ctx,env);this.env=env;this.repo=repository(ctx);const get=async()=>{if(!this.servicePromise)this.servicePromise=this.createService().catch(e=>{this.servicePromise=null;throw e;});return this.servicePromise;};
  this.client=createPublicClient({chain:sepolia,transport:http(env.HIR_INVOICE_RPC||'https://ethereum-sepolia-rpc.publicnode.com',{timeout:8000,retryCount:0}),cacheTime:0,ccipRead:false});
  const methods=['capabilities','workspace','organization','asset','prepareDraft','prepareSetup','dispatchSetup','attachSignature','preparePublication','attachHash','rejected','reconcile','setupStatus','setupHash','rejectSetup','prepareRegistration','registrationHash','registrationRecheck','registrationRejected'];const service=Object.fromEntries(methods.map(name=>[name,async(...args)=>(await get())[name](...args)]));Object.assign(service,{overview:()=>({records:this.repo.state.drafts.filter(d=>!platform.registeredHierarchy||d.policy?.ledger?.toLowerCase()===platform.ledger.toLowerCase())}),setupRecords:()=>this.repo.state.setups.filter(s=>!platform.registeredHierarchy||s.ledger?.toLowerCase()===platform.ledger.toLowerCase()),record:id=>{const d=this.repo.state.drafts.find(d=>d.id===id);if(!d||platform.registeredHierarchy&&d.policy?.ledger?.toLowerCase()!==platform.ledger.toLowerCase())throw Error('Invoice is not supported by this deployment');return invoiceDraftView(d,platform);},setupRecord:id=>{const s=this.repo.state.setups.find(s=>s.id===id);if(!s||platform.registeredHierarchy&&s.ledger?.toLowerCase()!==platform.ledger.toLowerCase())throw Error('Setup is not supported by this deployment');return s;}});this.service=service;
  this.access=new InvoiceAccess({service,origin:env.HIR_PUBLIC_ORIGIN});for(const row of this.repo.sql.exec('SELECT value FROM sessions WHERE expires > ?',Date.now())){const s=JSON.parse(row.value);if(s.origin===env.HIR_PUBLIC_ORIGIN)this.access.sessions.set(s.id,s);}
 }
 async createService(){const service=await createInvoiceService({baseURL:this.env.HIR_PUBLIC_ORIGIN,client:this.client,platform,repository:this.repo,renderPDF:summary=>createPDF(summary,{fontBytes,origin:this.env.HIR_PUBLIC_ORIGIN})});this.serviceReady=service;return service;}
 persistSessions(){const now=Date.now();this.ctx.storage.transactionSync(()=>{this.repo.sql.exec('DELETE FROM sessions WHERE expires <= ?',now);for(const s of this.access.sessions.values())if(s.expires>now)this.repo.sql.exec('INSERT INTO sessions(id,expires,value) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET expires=excluded.expires,value=excluded.value',s.id,s.expires,json(s));});}
 async fetch(request){return requestReads.run(new Map(),()=>this.#fetchRequest(request));}
 async #fetchRequest(request){let s;try{
  const origin=originFor(request,this.env),url=new URL(request.url),route=url.pathname.slice(5);s=this.access.cookie(request.headers.get('cookie')||'');
  if(request.method==='GET'&&route==='session'){const current=s||this.access.create();current.origin=origin;this.persistSessions();return response({token:current.csrf,chainId:platform.chainId,ledger:platform.ledger,cancellationSupported:false,documentStorage:'none',auth:this.access.public(current)},200,{'Set-Cookie':`hir_invoice_session=${current.id}; Secure; HttpOnly; SameSite=Strict; Path=/; Max-Age=1800`});}
  if(request.method==='GET'){
   if(route==='ledger-deployment')return response(await ledgerDeploymentStatus({client:this.client,manifest,hash:url.searchParams.get('hash')}));
   if(route==='platform')return response({chainId:platform.chainId,network:'Ethereum Sepolia',documentStorage:'none',defaultToken:platform.defaultToken,registeredHierarchy:!!platform.registeredHierarchy});
   if(route==='setup/history')return response(this.access.setupHistory(s));
   if(route==='setup/pending')return response(this.access.pendingSetup(s));
   if(route==='workspace'||route==='overview'){const view=await this.access.workspace(s,route==='workspace'?url.searchParams.get('org'):s?.org);return response(route==='overview'?{chainId:platform.chainId,records:view.records}:view);}
   const doc=route.match(/^document\/([a-f0-9-]{36})\.(pdf|json)$/),draft=route.match(/^draft\/([a-f0-9-]{36})$/);
   if(doc||draft){const d=await this.access.record(s,(doc||draft)[1]);if(doc&&doc[2]==='pdf')return response({error:'HIR does not store PDFs. Use your downloaded original.'},410);if(doc)return response({kind:'HIR-ENS-invoice-evidence',chainId:platform.chainId,ledger:platform.ledger,name:d.name,bundle:d.bundle,expectedSupplierMustBeChosenIndependently:true});return response(d);}
   return response({error:'Not found'},404);
  }
  if(request.method!=='POST')return response({error:'Method not supported'},405);
  if(request.headers.get('Origin')!==origin||!s||request.headers.get('x-hir-session')!==s.csrf||!request.headers.get('Content-Type')?.startsWith('application/json'))return response({error:'Browser session and same-origin request required'},403);
  const b=await readBody(request);if(b.pdfBase64&&Buffer.from(b.pdfBase64,'base64').length>5*1024*1024)return response({error:'Choose a PDF up to 5 MB'},413);
  if(route==='auth/challenge'){const result=this.access.challenge(s,b);this.persistSessions();return response(result);}
  if(route==='auth/verify'){const pending=this.access.verify(s,b);this.persistSessions();const result=await pending;this.persistSessions();return response(result);}
  if(route==='auth/logout'){this.access.logout(s);this.persistSessions();return response({authenticated:false});}
  if(route==='organization'||route==='capabilities')return response(await this.service[route](b.org,b.account));
  if(route==='verify')return response(await verifyReceived({client:this.client,platform,name:b.name,expectedOrg:b.expectedOrg,bytes:b.pdfBase64?Buffer.from(b.pdfBase64,'base64'):undefined}));
  if(['registration','registration/hash','registration/recheck','registration/rejected','setup','setup/dispatch','setup/receipt','setup/status','setup/rejected','draft','signature','publication','publication/hash','publication/rejected','publication/recheck'].includes(route)){const result=await this.access.call(s,route,b);this.persistSessions();return response(result);}
  return response({error:'Not found'},404);
 }catch(error){this.persistSessions();const unavailable=readFailure(error);return response(unavailable||{error:error.shortMessage||error.message},unavailable?503:error.status||400);}}
}
