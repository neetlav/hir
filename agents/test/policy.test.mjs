import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
import {encodeFunctionData} from 'viem';import {namehash} from 'viem/ens';
import {fixture} from './fixture.mjs';import {compile} from '../src/compile.mjs';
import {preparePolicy,inspectOrganization} from '../src/policy.mjs';import {lookupPolicy} from '../src/ens.mjs';import * as p from '../src/protocol.mjs';

test('shared official ENS artifact content matches pinned canonical JSON checksums',async()=>{
 const directory=new URL('../../vendor/ens-native/',import.meta.url),provenance=JSON.parse(await readFile(new URL('PROVENANCE.json',directory)));
 // The shared publication may normalize JSON escaping/whitespace; the pinned digest uses pretty JSON.
 for(const [file,hash] of Object.entries(provenance.artifacts))assert.equal(createHash('sha256').update(JSON.stringify(JSON.parse(await readFile(new URL(file,directory))),null,2)+'\n').digest('hex'),hash,file);
});

test('initial native policy preparation is explicit, role-bound and non-destructive',async t=>{
 const f=await fixture();t.after(()=>f.connection.close());const build=compile(),evidence=await f.deploy(build);
 const input={client:f.client,org:f.trust.org,label:'review',account:f.admin.address,chainId:31337,universal:f.universal.address,registry:f.registry.address,requester:f.requester.address,receiver:f.receiver.address,evidence:evidence.address,runtimeCodeHash:build.runtimeCodeHash};
 const original=await lookupPolicy({client:f.client,trust:f.trust,blockNumber:(await f.client.getBlock()).number});
 await t.test('owner and explicit native resolver/key binding are observed independently',async()=>{const r=await inspectOrganization(input);assert.equal(r.operator,true);assert.equal(r.canPublish,true);assert.equal(r.controller,f.admin.address);assert.equal(r.raw,'0x');assert.equal(r.recordId,0n);assert.equal(r.name,'review.agents.'+f.trust.org);});
 await t.test('unrelated account, wrong chain/registry and malformed names do not prepare',async()=>{
  await assert.rejects(()=>preparePolicy({...input,account:f.other.address}),/SET_DATA/);
  await assert.rejects(()=>preparePolicy({...input,chainId:1}),/chain/);
  await assert.rejects(()=>preparePolicy({...input,registry:f.other.address}));
  for(const org of ['UPPER.eth','child.parent.eth','missing.eth'])await assert.rejects(()=>preparePolicy({...input,org}));
  for(const label of ['','UPPER','bad.label','-bad','bad-'])await assert.rejects(()=>preparePolicy({...input,label}));
 });
 await t.test('dedicated distinct signers and independently selected evidence code are required',async()=>{
  await assert.rejects(()=>preparePolicy({...input,requester:f.admin.address}),/distinct/);
  await assert.rejects(()=>preparePolicy({...input,receiver:f.requester.address}),/distinct/);
  await assert.rejects(()=>preparePolicy({...input,runtimeCodeHash:p.zeroHash}),/runtime/);
 });
 await t.test('existing agent records are never overwritten by initial preparation',async()=>{await assert.rejects(()=>preparePolicy({...input,label:'requester'}),/occupied/);});
 let plan;
 await t.test('current root and Agents-key SET_DATA delegates can prepare; an unrelated key cannot',async()=>{
  await f.send(f.resolver,'grantRootRoles',[1n<<24n,f.other.address]);assert.equal((await inspectOrganization({...input,account:f.other.address})).canPublish,true);await f.send(f.resolver,'revokeRootRoles',[1n<<24n,f.other.address]);
  const setter=key=>encodeFunctionData({abi:f.resolver.abi,functionName:'setData',args:[p.wire(p.names(f.trust.org,'review').agent),key,'0x']});
  await f.send(f.resolver,'grantSetterRoles',[setter('unrelated.key'),f.other.address]);assert.equal((await inspectOrganization({...input,account:f.other.address})).operator,false);
  await f.send(f.resolver,'grantSetterRoles',[setter(p.KEY),f.other.address]);const before=await f.client.getBlockNumber();plan=await preparePolicy({...input,account:f.other.address});assert.equal(await f.client.getBlockNumber(),before);assert.equal(plan.transaction.from,f.other.address);assert.equal(plan.policy.controller,f.admin.address);assert.equal(plan.policy.maxCredits,50);assert.equal(plan.policy.agentNode,p.names(f.trust.org,'review').agentNode);assert.equal(plan.policy.priceTable,p.TABLE);assert.equal(plan.policy.validUntil<=f.policy.validUntil+1n,true);
 });
 await t.test('one disposable local publication resolves exact bytes and preserves other records',async()=>{
  const invoiceName='invoices.'+f.trust.org,invoiceKey='hir.invoice.config.v2';await f.send(f.resolver,'setData',[p.wire(invoiceName),invoiceKey,'0x1234']);const invoiceId=await f.read(f.resolver,'getRecordId',[namehash(invoiceName)]);
  const hash=await f.wallet.sendTransaction({account:f.other,to:plan.transaction.to,data:plan.transaction.data,value:0n});const receipt=await f.client.waitForTransactionReceipt({hash});assert.equal(receipt.status,'success');
  const resolved=await lookupPolicy({client:f.client,trust:plan.trust,blockNumber:receipt.blockNumber,checkpointHash:receipt.blockHash});assert.equal(resolved.raw,plan.raw);assert.equal(resolved.policyHash,plan.policyHash);assert.equal((await lookupPolicy({client:f.client,trust:f.trust,blockNumber:receipt.blockNumber})).raw,original.raw);
  const {nativeData,artifacts}=await import('../src/ens.mjs');const a=await artifacts();assert.equal((await nativeData({client:f.client,universal:f.universal.address,abi:a.UniversalResolverV2.abi,name:invoiceName,key:invoiceKey,blockNumber:receipt.blockNumber})).raw,'0x1234');assert.equal(await f.read(f.resolver,'getRecordId',[namehash(invoiceName)]),invoiceId);
  await assert.rejects(()=>preparePolicy({...input,account:f.other.address}),/occupied/);
 });
 await t.test('runtime signers with resolver administration cannot be provisioned into a new policy',async()=>{await f.send(f.resolver,'grantRootRoles',[1n<<24n,f.requester.address]);await assert.rejects(()=>preparePolicy({...input,label:'another'}),/administration/);});
});
