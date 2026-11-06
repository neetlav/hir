import test from 'node:test';import assert from 'node:assert/strict';import http from 'node:http';import {spawn} from 'node:child_process';import {readFile} from 'node:fs/promises';import {randomUUID} from 'node:crypto';import {once} from 'node:events';
import {loadPlatform} from '../app/customer/platform.mjs';

test('published server boots with empty isolated state and serves its complete public assets',{timeout:30000},async()=>{
 // This RPC stub proves startup/import closure only; chain security is tested against the local EVM separately.
 const rpc=http.createServer(async(req,res)=>{let text='';for await(const c of req)text+=c;const r=JSON.parse(text);assert.equal(r.method,'eth_chainId');res.setHeader('Content-Type','application/json');res.end(JSON.stringify({jsonrpc:'2.0',id:r.id,result:'0xaa36a7'}));});await new Promise(r=>rpc.listen(0,'127.0.0.1',r));
 const reserve=http.createServer();await new Promise(r=>reserve.listen(0,'127.0.0.1',r));const port=reserve.address().port;await new Promise(r=>reserve.close(r));const directory='.local/http-test-'+randomUUID(),base='http://127.0.0.1:'+port;
 const child=spawn(process.execPath,['app/customer/server.mjs'],{env:{...process.env,HIR_CUSTOMER_PORT:String(port),HIR_CUSTOMER_STATE:directory,HIR_INVOICE_RPC:'http://127.0.0.1:'+rpc.address().port},stdio:['ignore','pipe','pipe']});let stderr='';child.stderr.on('data',c=>stderr+=c);const exited=once(child,'exit');
 try{
  await Promise.race([new Promise(resolve=>child.stdout.on('data',c=>{if(c.toString().includes(base))resolve();})),exited.then(()=>{throw Error('Startup failed: '+stderr);}),new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error('Startup timeout: '+stderr)),15000);timer.unref();})]);
  const platform=await loadPlatform();assert.equal(platform.chainId,11155111);assert.ok(platform.abi.some(x=>x.name==='publish'));assert.equal(platform.cancellationSupported,false);
  const assets=['/','/setup','/setup/authority','/setup/review','/workspace','/invoices','/verify','/screens/home.html','/screens/identity.html','/screens/authority.html','/screens/review.html','/screens/workspace.html','/screens/verify.html','/site.mjs','/wallet.mjs','/presentation.mjs','/format.mjs','/fonts.css','/header-fonts.css','/stitch.css','/docs/invoices',...['font-0','font-1','font-2','font-3','font-4','header-0','header-1','header-2'].map(n=>'/fonts/'+n+'.ttf')];
  for(const route of assets){const r=await fetch(base+route);assert.equal(r.status,200,route);assert.ok((await r.arrayBuffer()).byteLength>0,route);}
  for(const route of ['/api/overview','/api/workspace?org=example.eth','/api/draft/11111111-1111-1111-1111-111111111111','/api/document/11111111-1111-1111-1111-111111111111.pdf'])assert.equal((await fetch(base+route)).status,401,route);
  for(const route of ['/.local/records.json','/config/sepolia.json','/docs/internal','/app.mjs','/style.css'])assert.equal((await fetch(base+route)).status,404,route);
  const session=await fetch(base+'/api/session');assert.equal((await session.json()).auth.authenticated,false);assert.match(session.headers.get('set-cookie'),/HttpOnly; SameSite=Strict/);
  await assert.rejects(readFile(directory+'/records.json'),{code:'ENOENT'});
  const control=await readFile(directory+'/process-control','utf8');const stop=await fetch(base+'/api/stop',{method:'POST',headers:{origin:base,'x-hir-control':control}});assert.equal(stop.status,200);assert.equal((await exited)[0],0,stderr);
 }finally{if(child.exitCode===null)child.kill();rpc.closeAllConnections();await new Promise(r=>rpc.close(r));}
});
