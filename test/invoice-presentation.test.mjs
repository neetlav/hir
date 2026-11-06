import test from 'node:test';import assert from 'node:assert/strict';
import {summary,renderVerification} from '../app/customer/public/presentation.mjs';
import {renderOperationState,setupOperation} from '../app/customer/public/invoice-states.mjs';
const pass={status:'pass'},result=()=>({findings:{historicalAuthenticity:pass,documentIntegrity:pass,currentIdentity:pass,currentDestination:pass,currentRevision:{status:'pass',code:'currentRevision'},currentRegistration:pass},request:{expectedOrg:'expected.eth',name:'inv-one.invoices.expected.eth'}});
test('verification presentation keeps backend findings independent and never announces success over an essential failure',()=>{
 assert.equal(summary(result()).tone,'good');for(const key of ['historicalAuthenticity','documentIntegrity','currentIdentity','currentDestination','currentRevision','currentRegistration'])for(const status of ['fail','unknown']){const r=result();r.findings[key]={status};assert.notEqual(summary(r).tone,'good',key+' '+status);}
 const changed=result();changed.findings.documentIntegrity={status:'fail'};const html=renderVerification(changed);assert.match(html,/Document changed/);assert.match(html,/Authorized at publication/);assert.match(html,/Recorded details available; received PDF changed/);assert.match(html,/Current version/);
 const wrong={findings:{verification:{status:'fail',code:'wrongExpectedSupplier'}}};assert.match(renderVerification(wrong),/Supplier does not match/);assert.doesNotMatch(renderVerification(wrong),/Invoice checks match/);
 const unavailable={findings:{verification:{status:'unknown',code:'rpcOrEvidenceUnavailable'}}};assert.equal(summary(unavailable).tone,'warn');assert.match(renderVerification(unavailable),/Unavailable/);
 assert.match(html,/Your PDF is used for verification and is not stored\./);assert.match(renderVerification({findings:{},request:{name:'<script>'}}),/&lt;script&gt;/);
});
test('wallet states distinguish signing, confirmation, decline, known failure and uncertain response',()=>{
 assert.match(renderOperationState({phase:'wallet',signature:true}),/message signature does not get block confirmations/);
 assert.match(renderOperationState({phase:'pending',hash:'0x'+'12'.repeat(32)}),/View existing transaction/);
 assert.match(renderOperationState({phase:'declined'}),/Earlier confirmed steps remain preserved/);
 assert.match(renderOperationState({phase:'failed'}),/not completed/);
 assert.match(renderOperationState({phase:'ambiguous'}),/Check the existing transaction before another request/);
 assert.doesNotMatch(renderOperationState({phase:'pending'}),/cannot be duplicated/);
});

test('setup preview names the actual operation without exposing contract jargon',()=>{for(const purpose of ['Create the organization’s official ENS subregistry.','Set the organization registry’s canonical ENS parent.','Create the official invoice subregistry.','Set the invoice registry’s canonical parent to the organization registry.','Attach the organization’s subregistry to its registered ENS identity.','Register invoices under the organization, owned by the organization owner.','Publish the reviewed receiving policy for the new guarded ledger']){const operation=setupOperation(purpose,'example.eth');assert.ok(operation.title&&operation.purpose);assert.doesNotMatch(operation.title+' '+operation.purpose,/subregistry|canonical|ledger|calldata/);}assert.equal(setupOperation('Register invoices under the organization','example.eth').title,'Register invoices.example.eth');assert.match(renderOperationState({phase:'prepared'}),/No wallet request has been sent/);});
