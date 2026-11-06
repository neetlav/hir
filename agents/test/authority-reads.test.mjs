import test from 'node:test';import assert from 'node:assert/strict';
import {authorityReads,withAuthorityFallback} from '../app/authority-reads.mjs';
import {WalletSessions} from '../app/access.mjs';
import {generatePrivateKey,privateKeyToAccount} from 'viem/accounts';
const missing=()=>Object.assign(Error('block not found: 0x123'),{name:'ResourceNotFoundRpcError',code:-32001,details:'block not found: 0x123'});
const checkpoint={number:123n,hash:'0x'+'a'.repeat(64)};
function fallbackFixture(){const calls=[],primary={getChainId:async()=>11155111,getBlock:async()=>checkpoint,readContract:async()=>{calls.push('primary');throw missing();},getCode:async()=>{throw missing();}},backup={getChainId:async()=>11155111,getBlock:async()=>checkpoint,readContract:async input=>{calls.push(input);return true;},getCode:async()=> '0x1234'};return{calls,primary,backup,reads:()=>authorityReads(withAuthorityFallback(primary,backup))};}
test('missing-block recovery validates the same chain and exact checkpoint without changing the pinned read',async()=>{
 const f=fallbackFixture(),reads=f.reads(),input={blockNumber:123n,functionName:'hasRoles'};await reads.getChainId();await reads.getBlock();assert.equal(await reads.readContract(input),true);assert.equal(f.calls.filter(c=>c==='primary').length,3);assert.equal(f.calls.at(-1),input);assert.equal(await reads.getCode({blockNumber:123n}),'0x1234');assert.deepEqual(await reads.getBlock({blockNumber:123n}),checkpoint);
});
test('concurrent permission reads share one fallback checkpoint validation',async()=>{
 const f=fallbackFixture();let validations=0;f.backup.getChainId=async()=>{validations++;return 11155111;};const reads=f.reads();await reads.getChainId();await reads.getBlock();assert.deepEqual(await Promise.all([reads.readContract({blockNumber:123n,args:['root']}),reads.readContract({blockNumber:123n,args:['key']})]),[true,true]);assert.equal(validations,1);assert.equal(f.calls.filter(c=>c==='primary').length,4);
});
for(const fault of ['wrong-chain','wrong-hash','older-block','reorg'])test('authority fallback refuses '+fault+' without accepting a permission result',async()=>{
 const f=fallbackFixture();if(fault==='wrong-chain')f.backup.getChainId=async()=>1;else if(fault==='wrong-hash')f.backup.getBlock=async()=>({...checkpoint,hash:'0x'+'b'.repeat(64)});else if(fault==='older-block')f.backup.getBlock=async()=>({...checkpoint,number:122n});else{let observations=0;f.backup.getBlock=async()=>++observations===1?checkpoint:{...checkpoint,hash:'0x'+'b'.repeat(64)};}
 const reads=f.reads();await reads.getChainId();await reads.getBlock();await assert.rejects(()=>reads.readContract({blockNumber:123n}));assert.equal(f.calls.filter(c=>c==='primary').length,3);
});
test('fallback results never authorize a later request from an earlier permission observation',async()=>{
 const f=fallbackFixture();let allowed=true;f.backup.readContract=async()=>allowed;
 for(const expected of [true,false]){allowed=expected;const reads=f.reads();await reads.getChainId();await reads.getBlock();assert.equal(await reads.readContract({blockNumber:123n}),expected);}
});
test('fallback never handles quota errors, deterministic reverts, unpinned reads or writes',async()=>{
 for(const error of [Object.assign(Error('Request exceeds defined limit.'),{name:'LimitExceededRpcError',code:-32005}),Object.assign(Error('execution reverted'),{name:'ContractFunctionRevertedError'})]){const f=fallbackFixture();let backups=0;f.primary.readContract=async()=>{throw error;};f.backup.getChainId=async()=>{backups++;return 11155111;};const reads=f.reads();await reads.getChainId();await reads.getBlock();await assert.rejects(()=>reads.readContract({blockNumber:123n}),e=>e===error);assert.equal(backups,0);}
 const f=fallbackFixture();let backups=0;f.backup.getChainId=async()=>{backups++;return 11155111;};const write=async()=>{throw missing();};f.primary.sendTransaction=write;const reads=f.reads();assert.equal(reads.sendTransaction,write);await assert.rejects(()=>reads.readContract({}));assert.equal(backups,0);
});
test('RPC backend lag retries the same pinned read without restarting the authority check',async()=>{
 const args={address:'public-address',functionName:'hasRoles',blockNumber:123n},received=[];
 const read=authorityReads({readContract:async input=>{received.push(input);if(received.length===1)throw Object.assign(Error('wrapped'),{cause:missing()});return true;}});
 assert.equal(await read.readContract(args),true);assert.equal(received.length,2);assert.equal(received[0],args);assert.equal(received[1],args);
});
test('one shared budget bounds persistent and multiple failing reads',async()=>{
 let calls=0;const error=missing(),read=authorityReads({readContract:async()=>{calls++;throw error;},getCode:async()=>{calls++;throw error;}});
 await assert.rejects(()=>read.readContract({}),e=>e===error);assert.equal(calls,3);await assert.rejects(()=>read.getCode({}),e=>e===error);assert.equal(calls,4);
});
test('deterministic reverts, malformed responses and unauthorized requests never retry',async()=>{
 for(const error of [Object.assign(missing(),{cause:{name:'ContractFunctionRevertedError'}}),Object.assign(Error('denied'),{name:'HttpRequestError',status:403}),Object.assign(Error('bad params'),{name:'InvalidParamsRpcError'}),Object.assign(Error('invalid policy'),{name:'Error'}),Object.assign(missing(),{details:'resource is not a block',message:'resource unavailable'})]){
  let calls=0;const read=authorityReads({readContract:async()=>{calls++;throw error;}});await assert.rejects(()=>read.readContract({}),e=>e===error);assert.equal(calls,1);
 }
});
test('only reads are wrapped; writes and challenge proofs are never retried',async()=>{
 let calls=0;const write=async()=>{calls++;throw missing();},read=authorityReads({sendTransaction:write,writeContract:write});assert.equal(read.sendTransaction,write);assert.equal(read.writeContract,write);await assert.rejects(()=>read.sendTransaction({}));assert.equal(calls,1);
});
test('transient authority recovery grants a valid proof, persistent failure never grants access',async()=>{
 const account=privateKeyToAccount(generatePrivateKey());
 for(const persistent of [false,true]){let calls=0;const sessions=new WalletSessions({origin:'https://hir-agents.test.workers.dev',operator:async()=>({allowed:await authorityReads({readContract:async()=>{calls++;if(persistent||calls===1)throw missing();return true;}}).readContract({blockNumber:123n})})}),s=sessions.create(),challenge=sessions.challenge(s,{account:account.address,org:'example.eth',chainId:11155111}),proof={signature:await account.signMessage({message:challenge.message})};
  if(persistent){await assert.rejects(()=>sessions.verify(s,proof),e=>e.status===503);assert.equal(sessions.public(s).authenticated,false);assert.equal(calls,3);}else{assert.equal((await sessions.verify(s,proof)).authenticated,true);assert.equal(calls,2);}await assert.rejects(()=>sessions.verify(s,proof),e=>e.status===401);
 }
});

test('an unavailable permission read blocks access without erasing or extending an authenticated session',async()=>{
 const account=privateKeyToAccount(generatePrivateKey());let now=Date.now(),mode='allowed';
 const sessions=new WalletSessions({origin:'https://hir-agents.test.workers.dev',now:()=>now,operator:async()=>{if(mode==='outage')throw missing();return{allowed:mode==='allowed'};}}),s=sessions.create(),challenge=sessions.challenge(s,{account:account.address,org:'example.eth',chainId:11155111});
 await sessions.verify(s,{signature:await account.signMessage({message:challenge.message})});s.contextId='selected-policy';const before={...sessions.public(s)},epoch=s.epoch;
 mode='outage';await assert.rejects(()=>sessions.require(s),e=>e.status===503);assert.deepEqual(sessions.public(s),before);assert.equal(s.epoch,epoch);
 mode='allowed';await sessions.require(s);assert.equal(s.contextId,'selected-policy');assert.equal(s.expires,new Date(before.expiresAt).getTime());
 mode='denied';await assert.rejects(()=>sessions.require(s),e=>e.status===403);assert.equal(sessions.public(s).authenticated,false);
});

test('logout during a failed authority read cannot restore the signed session',async()=>{
 const account=privateKeyToAccount(generatePrivateKey());let fail;
 const sessions=new WalletSessions({origin:'https://hir-agents.test.workers.dev',operator:async()=>({allowed:true})}),s=sessions.create(),challenge=sessions.challenge(s,{account:account.address,org:'example.eth',chainId:11155111});await sessions.verify(s,{signature:await account.signMessage({message:challenge.message})});
 sessions.operator=()=>new Promise((resolve,reject)=>{fail=reject;});const pending=sessions.require(s);sessions.logout(s);fail(missing());await assert.rejects(()=>pending,e=>e.status===401);assert.equal(sessions.public(s).authenticated,false);
});
import {chainDiagnostic} from '../worker/diagnostics.mjs';
test('chain diagnostics distinguish quota, RPC, gas and revert failures without retaining raw payloads',()=>{
 for(const [message,category]of [['Too many subrequests','subrequest-limit'],['block not found','rpc-block-unavailable'],['request timed out','rpc-timeout'],['too many requests','rpc-rate-limit'],['insufficient funds for gas','insufficient-gas-balance'],['execution reverted','contract-reverted']]){
  const secret='private-marker-do-not-retain',cause=Object.assign(Error(message+' https://rpc.invalid/'+secret),{name:'RpcRequestError',code:-32001,data:{privateKey:secret}}),error=Object.assign(Error('HTTP request failed '+secret),{name:'ContractFunctionExecutionError',functionName:'getParent',cause,requestBody:secret});const diagnostic=chainDiagnostic(error,'setup/registration-prepare','reference');assert.equal(diagnostic.category,category);assert.equal(diagnostic.operation,'setup/registration-prepare');assert.equal(diagnostic.causes[0].functionName,'getParent');assert.equal(diagnostic.causes[1].code,-32001);assert.doesNotMatch(JSON.stringify(diagnostic),new RegExp(secret+'|https://|requestBody|privateKey'));
 }
 const estimate=chainDiagnostic(Object.assign(Error('unavailable'),{name:'EstimateGasExecutionError'}),'wallet/intent','ref');assert.equal(estimate.category,'gas-estimate-failed');
});
test('diagnostics bound error chains and retain only numeric codes and statuses',()=>{
 const error=Object.assign(Error('raw'),{name:'https://rpc.invalid/private',code:'secret',status:'secret',functionName:'private(data)'});error.cause=error;const diagnostic=chainDiagnostic(error,'wallet/intent','reference');assert.deepEqual(diagnostic.causes,[{name:'Error'}]);assert.equal(diagnostic.category,'chain-service-unavailable');
});
test('initial ENS verification failures preserve a safe cause without granting access',async()=>{
 const account=privateKeyToAccount(generatePrivateKey()),cause=Object.assign(Error('block not found https://rpc.invalid/private-token'),{name:'ResourceNotFoundRpcError',code:-32001}),sessions=new WalletSessions({origin:'https://hir-agents.test.workers.dev',operator:async()=>{throw cause;}}),session=sessions.create(),challenge=sessions.challenge(session,{account:account.address,org:'example.eth',chainId:11155111});
 const signature=await account.signMessage({message:challenge.message});await assert.rejects(()=>sessions.verify(session,{signature}),error=>{assert.equal(error.status,503);assert.equal(error.cause,cause);assert.equal(chainDiagnostic(error,'auth/verify','ref').category,'rpc-block-unavailable');assert.doesNotMatch(error.message,/private-token/);return true;});assert.equal(sessions.public(session).authenticated,false);await assert.rejects(()=>sessions.verify(session,{signature}),error=>error.status===401);
});
test('active ENS verification failures retain the cause and signed selection without granting a protected action',async()=>{
 const account=privateKeyToAccount(generatePrivateKey()),sessions=new WalletSessions({origin:'https://hir-agents.test.workers.dev',operator:async()=>({allowed:true})}),session=sessions.create(),challenge=sessions.challenge(session,{account:account.address,org:'example.eth',chainId:11155111});await sessions.verify(session,{signature:await account.signMessage({message:challenge.message})});session.contextId='selected-agent';const before=sessions.public(session),cause=Object.assign(Error('timed out https://rpc.invalid/private-token'),{name:'TimeoutError'});sessions.operator=async()=>{throw cause;};
 await assert.rejects(()=>sessions.require(session),error=>{assert.equal(error.status,503);assert.equal(error.cause,cause);assert.equal(chainDiagnostic(error,'setup/registration-prepare','ref').category,'rpc-timeout');assert.doesNotMatch(error.message,/private-token/);return true;});assert.deepEqual(sessions.public(session),before);
});
test('an RPC provider limit is distinct from Cloudflare subrequest exhaustion',()=>{
 const provider=Object.assign(Error('Request exceeds defined limit.'),{name:'LimitExceededRpcError',code:-32005}),wrapped=new Error('Current ENS verification unavailable',{cause:provider}),diagnostic=chainDiagnostic(wrapped,'workspace','ref');assert.equal(diagnostic.category,'rpc-provider-limit');assert.equal(diagnostic.causes[1].code,-32005);assert.notEqual(diagnostic.category,'subrequest-limit');assert.equal(chainDiagnostic(new Error('Too many subrequests'),'workspace','ref').category,'subrequest-limit');
});
