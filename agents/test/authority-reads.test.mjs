import test from 'node:test';import assert from 'node:assert/strict';
import {authorityReads} from '../app/authority-reads.mjs';
import {WalletSessions} from '../app/access.mjs';
import {generatePrivateKey,privateKeyToAccount} from 'viem/accounts';
const missing=()=>Object.assign(Error('block not found: 0x123'),{name:'ResourceNotFoundRpcError',code:-32001,details:'block not found: 0x123'});
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
