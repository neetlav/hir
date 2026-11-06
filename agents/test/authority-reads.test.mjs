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
