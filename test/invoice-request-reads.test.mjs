import test from 'node:test';
import assert from 'node:assert/strict';
import {readOnce,requestReads} from '../app/customer/operation.mjs';

test('organization observations are shared only within the same request',async()=>{
 let reads=0,current='first';const read=async()=>{reads++;await Promise.resolve();return current;};
 await requestReads.run(new Map(),async()=>{
  assert.deepEqual(await Promise.all([readOnce('organization:a',read),readOnce('organization:a',read)]),['first','first']);
  assert.equal(reads,1);
  await readOnce('organization:b',read);assert.equal(reads,2);
 });
 current='rotated';await requestReads.run(new Map(),async()=>assert.equal(await readOnce('organization:a',read),'rotated'));
 assert.equal(reads,3);
 await Promise.all([requestReads.run(new Map(),()=>readOnce('organization:a',read)),requestReads.run(new Map(),()=>readOnce('organization:a',read))]);
 assert.equal(reads,5);
 await requestReads.run(new Map(),async()=>{let attempts=0;const fail=()=>{attempts++;throw Error('Too many subrequests.');};await assert.rejects(readOnce('failure',fail));await assert.rejects(readOnce('failure',fail));assert.equal(attempts,1,'a failed observation is not automatically retried');});
 await readOnce('organization:a',read);await readOnce('organization:a',read);assert.equal(reads,7,'unscoped callers retain fresh-read behavior');
});
