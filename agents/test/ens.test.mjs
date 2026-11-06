import test from 'node:test';import assert from 'node:assert/strict';
import {fixture} from './fixture.mjs';import {lookupPolicy} from '../src/ens.mjs';import * as p from '../src/protocol.mjs';
test('Native ENSv2 authority, historical checkpoints and fail-closed boundaries',async t=>{
 const f=await fixture();t.after(()=>f.connection.close());
 const lookup=async overrides=>lookupPolicy({client:f.client,trust:f.trust,blockNumber:(await f.client.getBlock()).number,...overrides});
 const original=await lookup();assert.equal(original.raw,p.encodePolicy(f.policy));assert.equal(original.usesHIRAuthorityAPI,false);assert.equal(original.policyHash,p.hash(original.raw));
 await t.test('fixed table derives price from exact parameters',()=>{assert.equal(p.price(0),40);assert.equal(p.price(1),80);assert.throws(()=>p.price(2));assert.notEqual(p.parametersHash(0),p.parametersHash(1));});
 await t.test('runtime agents have no data or link administrator rights',async()=>{for(const who of [f.requester,f.receiver]){assert.equal(await f.read(f.resolver,'hasRoles',[0n,1n<<152n,who.address]),false);assert.equal(await f.read(f.resolver,'hasRoles',[0n,1n<<28n,who.address]),false);await assert.rejects(()=>f.send(f.resolver,'setData',[p.wire(f.n.agent),p.KEY,p.encodePolicy(f.policy)],who));}});
 for(const [key,value] of Object.entries({requester:f.other.address,receiver:f.other.address,controller:f.other.address,ownershipResource:0n,generation:p.zeroHash,chainId:1n,agentNode:p.zeroHash,action:p.zeroHash,priceTable:p.zeroHash,maxCredits:80,validUntil:1n,validAfter:99999999999n,version:2}))await t.test('reject altered '+key,async()=>{await f.configure(p.encodePolicy({...f.policy,[key]:value}));await assert.rejects(lookup);});
 for(const value of ['0x','0x1234',p.encodePolicy(f.policy)+'00'])await t.test('absent/malformed/noncanonical policy denied',async()=>{await f.configure(value);await assert.rejects(lookup);});
 await t.test('historical ENS resolves original exact bytes after policy changed',async()=>{const historical=await lookup({blockNumber:original.blockNumber,checkpointHash:original.blockHash});assert.equal(historical.raw,original.raw);});
 await t.test('wrong checkpoint or unavailable historical RPC never authorizes',async()=>{await assert.rejects(()=>lookup({blockNumber:original.blockNumber,checkpointHash:p.zeroHash}));await assert.rejects(()=>lookupPolicy({trust:f.trust,client:{getChainId:async()=>31337,getBlock:async()=>{throw Error('Archive unavailable');}}}));});
 await f.configure();
 await t.test('record relinking is detected',async()=>{await f.send(f.resolver,'setData',[p.wire('unrelated.'+f.trust.org),p.KEY,p.encodePolicy(f.policy)]);const otherId=await f.read(f.resolver,'getRecordId',[p.names(f.trust.org).orgNode]).catch(()=>0n);assert.equal(otherId,0n);await f.send(f.resolver,'linkToRecord',[p.wire(f.n.agent),0n]);await assert.rejects(lookup);});
});
