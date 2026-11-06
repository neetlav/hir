import test from 'node:test';
import assert from 'node:assert/strict';
import {pdfEnvironment} from '../app/pdf-network.mjs';
test('local invoice network wording remains exact; Sepolia is explicitly a testnet',()=>{
 assert.deepEqual(pdfEnvironment(31337),{banner:'LOCAL DEMONSTRATION - NO REAL PAYMENT',asset:'local demo asset',network:'HIR local chain · 31337'});
 assert.deepEqual(pdfEnvironment(11155111),{banner:'SEPOLIA TESTNET - NO REAL PAYMENT',asset:'Sepolia test asset',network:'Sepolia testnet · 11155111'});
 assert.throws(()=>pdfEnvironment(1),/Unsupported/);
});
