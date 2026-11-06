import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';import vm from 'node:vm';
import {accessView,setupView,policyView,interactionView,historyView,walletProgress} from '../public/views.mjs';
import {SAMPLE} from '../src/analysis.mjs';
import {walletOperation} from '../public/wallet-state.mjs';
import {registrationPanel} from '../public/registration-view.mjs';
const org='organization.eth',label='analysis',name=label+'.agents.'+org,requester='0x0000000000000000000000000000000000000001',receiver='0x0000000000000000000000000000000000000002',wallet='0x0000000000000000000000000000000000000003';
const profile={id:'context',name,trust:{org,label,requester,receiver,controller:wallet,resolver:receiver,evidence:requester,chainId:11155111},policy:{validAfter:1793970000,validUntil:1794000000},publication:{nativeObserved:true}};
const base=()=>({profile,contexts:[profile],current:{status:'valid',registration:{status:'registered'}},jobs:[],wallet:{operations:{}}});
const check=()=>({org,label,name,account:wallet,controller:wallet,registration:{status:'registered'},keys:{requester,receiver},canConfigure:true});
const op=status=>({key:'policy:review',operation:'policy',status,preparedAt:'2026-11-06T10:00:00.000Z',transaction:{from:wallet,to:receiver,data:'0x1234'},gasEstimate:'12345'});
const saved=()=>({id:'request',state:{envelope:{request:{requestId:'request',mode:1,credits:80,createdAt:1793970000,requester}},assessment:{status:'outside-authority',reason:'80 exceeds 50'},decision:{accepted:true},reason:'Actual receiver choice',outcome:{status:1},output:{count:8,sum:'126',minimum:'9',maximum:'24',mean:{numerator:'126',denominator:'8'}},sealed:{bundleHash:'commitment'},violation:true,activity:[{type:'public-message',actor:'Agent 2',at:'2026-11-06T10:02:03.000Z',publicText:'Actual message <unsafe>'}]}});
test('a failed next-step read preserves confirmed deployment evidence without inventing current progress',()=>{
 const hash='0x'+'a'.repeat(64),confirmed={operation:'registration',status:'confirmed',registrationStage:'deploy-agents-registry',registration:{org,label},receipt:{status:'success'},hash},model=base();model.wallet.operations={deployment:confirmed};
 for(const checked of [{...check(),registration:{status:'namespace-unregistered',nextStageUnavailable:true,message:'The next registration step could not be verified.'}},null]){
  const html=setupView(model,{org,label,checked,checkError:'The current registration step could not be verified.'});assert.match(html,/1 previously confirmed/);assert.match(html,/Previously confirmed transaction/);assert.ok(html.includes(hash));assert.match(html,/Current state not verified/);assert.doesNotMatch(html,/Not started|data-action="register-name"/);assert.match(html,/data-action="check-setup">Check names again/);assert.match(html,/does not send or repeat a transaction/);assert.equal(confirmed.status,'confirmed');
 }
 const unrelated=registrationPanel({status:'unavailable'},{org:'different.eth',label,steps:true,operations:model.wallet.operations});assert.doesNotMatch(unrelated,/previously confirmed|Previously confirmed transaction/);
});
test('a failed setup recheck clears a stale next-transaction action and recovery installs the fresh observation',async()=>{
 const source=await readFile(new URL('../public/workspace.mjs',import.meta.url),'utf8'),line=source.split('\n').find(x=>x.startsWith('async function checkSetup()'));
 const setup={org,label,checked:{registration:{nextStage:'deploy-agents-registry'}}},context=vm.createContext({setup,account:wallet,api:async()=>{throw Error('isolated outage');}});vm.runInContext(line,context);
 await assert.rejects(()=>context.checkSetup(),/isolated outage/);assert.equal(setup.checked,null);assert.match(setup.checkError,/Previously confirmed transactions are retained/);
 const next={registration:{nextStage:'set-agents-parent'}};context.api=async()=>next;assert.equal(await context.checkSetup(),next);assert.equal(setup.checkError,null);
});
test('entry has no assumed organization, wallet or access; an observation is not sign-in',()=>{
 const empty=accessView({org:'',account:null});assert.match(empty,/Find organization/);assert.match(empty,/data-action="connect" disabled/);assert.match(empty,/data-action="authenticate" disabled/);assert.doesNotMatch(empty,/Organization found/);
 const found=accessView({org,organization:{org},account:null});assert.match(found,/Organization found/);assert.match(found,/data-action="authenticate" disabled/);assert.doesNotMatch(found,/Organization access checked/);
 assert.doesNotMatch(accessView({org:'changed.eth',organization:{org},account:wallet}),/Organization found/);
});
test('registration steps reuse observed progress and never invent completed steps',()=>{
 for(const [index,nextStage]of ['deploy-agents-registry','set-agents-parent','register-agents','register-requester'].entries()){
  const html=registrationPanel({status:index===3?'requester-unregistered':'namespace-unregistered',nextStage},{org,label,canPrepare:true,steps:true});assert.match(html,new RegExp(index+' of 4 confirmed'));assert.equal((html.match(/class="done"/g)??[]).length,index);assert.equal((html.match(/data-action="register-name"/g)??[]).length,1);
 }
 const unchecked=registrationPanel(null,{org,label,steps:true,canPrepare:true});assert.doesNotMatch(unchecked,/of 4 confirmed|class="done"|data-action="register-name"/);
 const missing=setupView(base(),{org,label,checked:{...check(),registration:{status:'organization-prerequisite'}},keys:{requester,receiver}});assert.match(missing,/data-action="review-permissions" disabled/);
});
test('first-time permissions review uses actual preview dates, target and bytes; existing policy is read only',()=>{
 const model=base(),checked=check(),plan={policy:profile.policy,raw:'0xreviewed',policyHash:'reviewed-hash',preparedAt:'2026-11-06T10:00:00.000Z',transaction:{to:receiver,data:'0x1234'}};
 const review=setupView(model,{org,label,checked,permissions:true});assert.match(review,/Review permissions/);assert.doesNotMatch(review,/data-action="publish-policy"/);
 const prepared=setupView(model,{org,label,checked,permissions:true,plan});assert.match(prepared,/Publish permissions/);assert.match(prepared,/0xreviewed/);assert.match(prepared,/hir.agents.identity-policy.v1/);
 const existing=policyView(model);assert.match(existing,/Existing permissions found/);assert.doesNotMatch(existing,/data-action="publish-policy"|data-action="preview"/);
});
test('wallet approval, interruption, decline and confirmation are distinct and use actual intent data',()=>{
 const model=base();
 for(const [status,title]of [['awaiting-wallet','Waiting for wallet approval'],['wallet-dispatched','Wallet response interrupted'],['submitted','Waiting for confirmation'],['rejected','Approval declined'],['failed','Transaction failed']]){
  model.wallet.operations={review:{...op(status),...(status==='submitted'?{hash:'0xexisting'}:{})}};const html=walletProgress(model);assert.match(html,new RegExp(title));assert.match(html,/12345/);
  assert.equal(html.includes('id="recovery-hash"'),status==='wallet-dispatched');assert.equal(html.includes('data-action="wallet-retry"'),['rejected','failed'].includes(status));assert.equal(html.includes('data-action="wallet-send"'),status==='awaiting-wallet');assert.doesNotMatch(html,/transactions cannot be duplicated|0 of 2 required/);
 }
});
test('empty activity has no scripted messages; actual adverse behavior stays recordable and separate',()=>{
 const model=base();let html=interactionView(model,null,'');assert.match(html,/No activity yet/);assert.match(html,/No result yet/);assert.doesNotMatch(html,/Request signed and submitted|15\.75|Actual message/);
 model.jobs=[saved()];model.jobs[0].state.activity.push({type:'tool-result',actor:'Agent 2',tool:'perform_analysis',at:'2026-11-06T10:02:04.000Z'});html=interactionView(model,null,'');assert.match(html,/Actual message &lt;unsafe&gt;/);assert.match(html,/Exceeds published permissions/);assert.match(html,/Accepted/);assert.match(html,/Completed/);assert.match(html,/Signed record saved/);assert.match(html,/data-action="anchor:request"/);assert.doesNotMatch(html,/Awaiting outcome/);assert.doesNotMatch(html,/Evidence verified/);
});
test('history starts unverified and shows receiver-reported non-execution without claiming proof',()=>{
 const model=base();model.jobs=[saved()];model.jobs[0].state.decision.accepted=false;model.jobs[0].state.outcome.status=0;model.jobs[0].state.output=null;model.jobs[0].state.violation=false;
 const html=historyView(model,{filters:{}});assert.match(html,/Receiver reports not run/);assert.match(html,/does not prove hidden non-execution/);assert.match(html,/Not checked/);assert.doesNotMatch(html,/Evidence verified|Local cryptographic store|no.sign.in/);
});

test('a new name has its own full preview while existing policy and history stay selected',()=>{
 const model=base(),html=setupView(model,{org,label:'another-agent',newAgent:true,keys:{requester,receiver}});
 assert.match(html,/Register a new agent/);assert.match(html,/another-agent.agents.organization.eth/);assert.match(html,/value="another-agent"/);assert.match(html,/Return to selected agent/);assert.match(html,/deployment’s runtime/);assert.equal(model.profile.name,name);
 assert.match(policyView(model),/data-action="new-agent"/);assert.doesNotMatch(policyView(model),/data-action="publish-policy"/);
});
test('analysis scope names the actual fixed dataset and preserves real agent choice',()=>{
 const html=interactionView(base(),null,'');assert.ok(html.includes(SAMPLE.series.join(', ')));assert.match(html,/always analyzes the same response times/);assert.match(html,/choose their messages, tools and decisions/);
});
test('current name registration and published policy remain independent findings',()=>{
 const model=base();model.current={status:'unregistered',policyStatus:'valid',registration:{status:'namespace-unregistered'}};const html=policyView(model);assert.match(html,/Published permissions verified/);assert.match(html,/Registration not confirmed/);assert.match(html,/Continue name setup/);assert.doesNotMatch(html,/Ready for new interactions/);
});
for(const status of ['rejected','failed'])test('historical '+status+' request does not block the next stage after a later confirmation',()=>{
 const model=base(),old={...op(status),key:'registration:old',operation:'registration',preparedAt:'2026-11-06T10:00:00.000Z'},latest={...op('confirmed'),key:'registration:new',operation:'registration',preparedAt:'2026-11-06T10:01:00.000Z'};
 model.wallet.operations={[old.key]:old,[latest.key]:latest};assert.equal(walletOperation(model),null);assert.equal(walletProgress(model),'');
 const html=setupView(model,{org,label,checked:{...check(),registration:{status:'namespace-unregistered',nextStage:'set-agents-parent'}},keys:{requester,receiver}});assert.match(html,/data-action="register-name">/);assert.doesNotMatch(html,/Approval declined|Transaction failed/);assert.equal(model.wallet.operations[old.key].status,status);
});
test('the current declined or failed request remains the exact displayed retry target',()=>{
 const model=base();for(const status of ['rejected','failed']){const old={...op('confirmed'),key:'old',preparedAt:'2026-11-06T10:00:00.000Z'},latest={...op(status),key:'new',preparedAt:'2026-11-06T10:01:00.000Z'};model.wallet.operations={old,new:latest};assert.equal(walletOperation(model),latest);assert.match(walletProgress(model),/data-action="wallet-retry"/);}
});
test('an explicit name check reports observed availability and wallet access separately',()=>{
 for(const [nameStatus,text]of [['available','Name available'],['registered','Registered to your organization'],['conflict','Name unavailable'],['unavailable','Name check unavailable'],['pending-hierarchy','Complete the group names first']]){
  const html=setupView(base(),{org,label:'user-chosen',newAgent:true,checked:{...check(),name:'user-chosen.agents.'+org,nameStatus,permission:true},keys:{requester,receiver}});assert.match(html,/Check name and access/);assert.ok(html.includes(text));assert.match(html,/user-chosen.agents.organization.eth/);assert.match(html,/Publication access verified for this wallet/);
 }
});
