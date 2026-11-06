import test from 'node:test';
import assert from 'node:assert/strict';
import {revertedTransaction} from '../app/customer/failed-transaction.mjs';
const intent={hash:'0x123',account:'0xabc',to:'0xdef',data:'0x1234',nonce:5};
function fixture(){return{getChainId:async()=>11155111,getTransactionReceipt:async()=>({transactionHash:intent.hash,status:'reverted',blockNumber:10n,blockHash:'0xblock',gasUsed:20n,effectiveGasPrice:3n}),getTransaction:async()=>({from:intent.account,to:intent.to,input:intent.data,value:0n,chainId:11155111,nonce:5}),getBlock:async()=>({hash:'0xblock'}),getBlockNumber:async()=>11n,getTransactionCount:async()=>6};}
test('retry requires exact canonical reverted receipt, confirmation depth and consumed nonce',async()=>{
 const client=fixture();assert.equal((await revertedTransaction(client,intent,{chainId:11155111,retry:true})).feeWei,60n);
 for(const change of [
  {getChainId:async()=>1},
  {getTransactionReceipt:async()=>{throw Error('Receipt not found');}},
  {getTransactionReceipt:async()=>({...await client.getTransactionReceipt(),status:'success'})},
  {getBlock:async()=>({hash:'0xreorg'})},
  {getBlockNumber:async()=>10n},
  {getTransactionCount:async()=>5},
  {getTransactionCount:async({blockTag})=>blockTag==='pending'?7:6},
  {getTransaction:async()=>({...await client.getTransaction(),input:'0xother'})},
  {getTransaction:async()=>({...await client.getTransaction(),nonce:6})}
 ])await assert.rejects(revertedTransaction({...client,...change},intent,{chainId:11155111,retry:true}));
 await assert.rejects(revertedTransaction(client,{...intent,hash:undefined},{chainId:11155111,retry:true}),/hash/);
});
