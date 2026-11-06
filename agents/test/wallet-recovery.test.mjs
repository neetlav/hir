import test from 'node:test';import assert from 'node:assert/strict';
import {WorkspaceWallet} from '../app/wallet.mjs';
const hash='0x'+'a'.repeat(64),blockHash='0x'+'b'.repeat(64),from='0x'+'1'.repeat(40),to='0x'+'2'.repeat(40);
function fixture(operation='registration'){
 const row={key:'original',operation,status:'submitted',hash,transaction:{from,to,data:'0x1234',nonce:'0x3',chainId:'0xaa36a7',value:'0x0'},planId:'original-plan',contextId:'original-context',jobId:'original-job'};
 let state={operations:{original:structuredClone(row)}};const receipt={transactionHash:hash,blockNumber:10n,blockHash,transactionIndex:0,status:'reverted'},tx={hash,from,to,input:'0x1234',nonce:3,chainId:11155111,value:0n,blockNumber:10n,blockHash,transactionIndex:0};
 const client={getChainId:async()=>11155111,getTransactionReceipt:async()=>receipt,getTransaction:async()=>tx,getBlock:async()=>({number:10n,hash:blockHash,transactions:[hash]}),getBlockNumber:async()=>11n,getTransactionCount:async()=>4};
 const db={get:()=>structuredClone(state),put:(_,value)=>{state=structuredClone(value);}};
 return{wallet:new WorkspaceWallet({client,db}),client,receipt,tx,row,state:()=>state.operations.original};
}
for(const operation of ['registration','policy','anchor'])test(operation+': canonical failure preserves exact request and needs a separate review',async()=>{
 const f=fixture(operation),failed=await f.wallet.confirm('original');assert.equal(failed.status,'failed');assert.deepEqual(failed.transaction,f.row.transaction);assert.equal(failed.hash,hash);assert.deepEqual(failed.receipt,f.receipt);
 let checked=false;f.wallet.intent=async input=>{checked=true;assert.deepEqual(input,{operation,planId:'original-plan',id:'original-job',contextId:'original-context',account:from,retryOf:'original'});return input;};await f.wallet.retry('original');assert.ok(checked);
});
for(const [name,alter]of [
 ['missing receipt',f=>{f.client.getTransactionReceipt=async()=>{throw Error('not found');};}],
 ['noncanonical receipt',f=>{f.client.getBlock=async()=>({number:10n,hash:'0x'+'c'.repeat(64)});}],
 ['wrong receipt transaction',f=>{f.receipt.transactionHash='0x'+'c'.repeat(64);}],
 ['wrong transaction sender',f=>{f.tx.from=to;}],
 ['wrong transaction target',f=>{f.tx.to=from;}],
 ['wrong transaction calldata',f=>{f.tx.input='0x5678';}],
 ['wrong transaction nonce',f=>{f.tx.nonce=4;}],
 ['wrong transaction block',f=>{f.tx.blockNumber=9n;}],
 ['transaction missing from canonical block',f=>{f.client.getBlock=async()=>({number:10n,hash:blockHash,transactions:[]});}],
 ['wrong receipt transaction index',f=>{f.receipt.transactionIndex=1;}],
 ['wrong chain',f=>{f.client.getChainId=async()=>1;}],
 ['unknown receipt outcome',f=>{f.receipt.status='unknown';}]
])test(name+' never becomes a retryable failure',async()=>{const f=fixture();alter(f);await assert.rejects(()=>f.wallet.confirm('original'));assert.equal(f.state().status,'submitted');await assert.rejects(()=>f.wallet.retry('original'));});
test('one confirmation remains unresolved even when the receipt reverted',async()=>{const f=fixture();f.client.getBlockNumber=async()=>10n;assert.equal((await f.wallet.confirm('original')).status,'confirming');await assert.rejects(()=>f.wallet.retry('original'));});
for(const [name,alter]of [
 ['reorg',f=>{f.client.getBlock=async()=>({number:10n,hash:'0x'+'c'.repeat(64)});}],
 ['missing receipt',f=>{f.client.getTransactionReceipt=async()=>{throw Error('not found');};}],
 ['nonce not consumed',f=>{f.client.getTransactionCount=async()=>3;}]
])test('a previously verified failure with '+name+' becomes unresolved and cannot unlock a new intent',async()=>{
 const f=fixture();await f.wallet.confirm('original');alter(f);await assert.rejects(()=>f.wallet.intent({operation:'registration',planId:'another-plan',account:from}));assert.equal(f.state().status,'submitted');assert.equal(f.state().hash,hash);assert.deepEqual(f.state().transaction,f.row.transaction);
});
