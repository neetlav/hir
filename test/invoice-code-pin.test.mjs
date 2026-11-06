import test from 'node:test';import assert from 'node:assert/strict';import {keccak256} from 'viem';
import {createInvoiceService} from '../app/customer/service.mjs';
test('organization lookup handles absent ledger bytecode before hashing and never bypasses its runtime pin',async t=>{
 const platform={chainId:11155111,registeredHierarchy:true,ledger:'0x'+'12'.repeat(20),runtimeCodeHash:keccak256('0x1234')};let code,chain=11155111,reads=0;
 const client={getChainId:async()=>chain,getCode:async()=>code,readContract:async()=>{reads++;throw Error('ENS read reached');}},repository={load:async()=>({version:1,drafts:[],setups:[]}),save:async()=>{}};
 const service=await createInvoiceService({client,platform,repository});
 for(const value of [undefined,'0x'])await t.test('missing code '+String(value)+' gives the deployment instruction',async()=>{code=value;await assert.rejects(service.organization('example.eth'),/has not been deployed\. Review \/ledger-deployment\.html/);assert.equal(reads,0);});
 await t.test('different deployed code remains blocked',async()=>{code='0x5678';await assert.rejects(service.organization('example.eth'),/does not match the reviewed runtime/);assert.equal(reads,0);});
 await t.test('matching code permits ENS lookup',async()=>{code='0x1234';await assert.rejects(service.organization('example.eth'),/ENS read reached/);assert.equal(reads,1);});
 await t.test('wrong RPC network remains blocked',async()=>{chain=1;await assert.rejects(service.organization('example.eth'),/Wrong network/);assert.equal(reads,1);});
});
