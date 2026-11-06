import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {encodeDeployData,getContractAddress,keccak256} from 'viem';
import {compile} from '../scripts/invoice-record/compile-registered.mjs';
import {ledgerDeploymentStatus} from '../app/customer/ledger-deployment.mjs';
const read=p=>JSON.parse(readFileSync(p,'utf8')),manifest=read('config/registered-ledger-deployment.json');
test('reviewed deployment bytecode, ABI, source hashes and predicted address match the public configuration',async()=>{
 const c=await compile(),config=read('config/registered-sepolia.json');
 assert.deepEqual(c.sourceHashes,manifest.sourceHashes);assert.deepEqual(c.abi,read('config/registered-invoice-ledger-abi.json'));
 assert.equal(encodeDeployData({abi:c.abi,bytecode:c.bytecode,args:[manifest.universal,manifest.ethRegistry,manifest.registryFactory,manifest.registryImplementation]}),manifest.tx.data);
 assert.equal(getContractAddress({from:manifest.operator,nonce:BigInt(manifest.nonce)}).toLowerCase(),manifest.expectedAddress.toLowerCase());
 assert.equal(config.ledger,manifest.expectedAddress);assert.equal(config.runtimeCodeHash,manifest.runtimeCodeHash);assert.equal(manifest.tx.value,'0x0');
});
test('deployment reconciliation never broadcasts and rejects changed nonce, code or transaction',async t=>{
 const runtime='0x1234',m={...manifest,runtimeCodeHash:keccak256(runtime)},hash='0x'+'12'.repeat(32);let code='0x',nonce=m.nonce;
 let tx={from:m.operator,to:null,input:m.tx.data,value:0n,chainId:m.chainId,nonce:m.nonce},receipt={status:'success',contractAddress:m.expectedAddress,blockNumber:10n,transactionHash:hash,gasUsed:100n,effectiveGasPrice:2n},block=11n;
 const client={getChainId:async()=>m.chainId,getCode:async()=>code,getTransactionCount:async()=>nonce,getTransaction:async()=>tx,getTransactionReceipt:async()=>receipt,getBlockNumber:async()=>block};
 const check=(h)=>ledgerDeploymentStatus({client,manifest:m,hash:h});
 await t.test('exact unused nonce is ready; another pending nonce requires a new review',async()=>{assert.equal((await check()).status,'ready');nonce++;assert.equal((await check()).status,'review-required');nonce--;});
 await t.test('a matching receipt requires two confirmations and exact runtime code',async()=>{block=10n;assert.equal((await check(hash)).status,'pending');block=11n;code=runtime;assert.equal((await check(hash)).receipt.feeWei,200n);code='0x5678';await assert.rejects(check(hash),/Unsupported code/);code=runtime;});
 await t.test('foreign sender, changed input, destination, value, chain and nonce are rejected',async()=>{for(const changes of [{from:'0x'+'12'.repeat(20)},{input:'0x1234'},{to:m.operator},{value:1n},{chainId:1},{nonce:m.nonce+1}]){const old=tx;tx={...tx,...changes};await assert.rejects(check(hash),/does not match/);tx=old;}});
 await t.test('reverted deployment remains reverted',async()=>{receipt={...receipt,status:'reverted'};assert.equal((await check(hash)).status,'reverted');});
});
