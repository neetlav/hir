import {encodeFunctionData,zeroAddress} from 'viem';
import {registrationABI as abi,registrationSnapshot,ADMIN_ROLES,SET_PARENT} from '../src/registration.mjs';import * as p from '../src/protocol.mjs';
import {artifacts,nativeData} from '../src/ens.mjs';
export async function nextRegistration({client,checked,anchors,account,keys}){
 const trust={...checked,requester:keys.requester,receiver:keys.receiver},state=await registrationSnapshot({client,trust,anchors,blockNumber:checked.blockNumber,checkpointHash:checked.blockHash});
 if(state.status==='registered'||state.status==='organization-prerequisite')return{state,transaction:null};
 p.need(p.eq(account,checked.controller),'The organization controller must approve initial registry setup; runtime signers are not administrators');
 const read=(address,functionName,args=[])=>client.readContract({address,abi,functionName,args,blockNumber:checked.blockNumber}),encode=(functionName,args)=>encodeFunctionData({abi,functionName,args});
 let to,data,stage,purpose,registry=state.namespaceRegistry;
 if(state.status==='namespace-unregistered'){
  p.need(!state.namespace||p.eq(state.namespace.latestOwner,zeroAddress)&&Number(state.namespace.status)===0,'Existing or reserved Agents namespace needs explicit review; no registration overwrite');
  const salt=BigInt(p.textHash('HIR Agents registry v1:'+checked.chainId+':'+checked.org+':'+state.organizationRegistry.toLowerCase()));
  registry=await read(anchors.factory,'predictProxyAddress',[account,salt]);
  const code=await client.getCode({address:registry,blockNumber:checked.blockNumber});
  if(!code||code==='0x'){
   const init=encode('initialize',[[{account:checked.controller,roleBitmap:ADMIN_ROLES}]]);
   to=anchors.factory;data=encode('deployProxy',[anchors.implementation,salt,init]);stage='deploy-agents-registry';purpose='Create the official ENS child registry for agents.'+checked.org+' with administration held only by the organization controller';
  }else{
   p.need(p.eq(await read(anchors.factory,'verifyContract',[registry]),anchors.implementation),'Predicted registry contains unexpected code');
   p.need(await read(registry,'hasRootRoles',[ADMIN_ROLES,checked.controller]),'Predicted registry has unexpected controller permissions');
   const [parent,label]=await read(registry,'getParent');
   if(p.eq(parent,zeroAddress)&&label===''){
    p.need(await read(registry,'hasRootRoles',[SET_PARENT,account]),'Controller cannot set the registry parent');
    to=registry;data=encode('setParent',[state.organizationRegistry,'agents']);stage='set-agents-parent';purpose='Bind the Agents registry to the confirmed organization registry under the agents label';
   }else{
    p.need(p.eq(parent,state.organizationRegistry)&&label==='agents','Predicted registry has an unexpected parent');
    p.need(await read(state.organizationRegistry,'hasRootRoles',[1n,account]),'Controller lacks registration permission in the shared organization registry');
    to=state.organizationRegistry;data=encode('register',['agents',checked.controller,registry,checked.resolver,ADMIN_ROLES,checked.organizationExpiry]);stage='register-agents';purpose='Register agents.'+checked.org+' with the existing resolver and organization-controlled child registry';
   }
  }
 }else{
  p.need(p.eq(state.requester.latestOwner,zeroAddress)&&Number(state.requester.status)===0,'Existing or reserved requester registration needs explicit review; no overwrite');
  p.need(await read(registry,'hasRootRoles',[1n,account]),'Controller lacks registration permission in the Agents registry');
  to=registry;data=encode('register',[checked.label,checked.controller,zeroAddress,checked.resolver,ADMIN_ROLES,state.namespace.expiry]);stage='register-requester';purpose='Register '+checked.name+' while preserving the existing resolver, signing identities and policy bytes';
 }
 return{state,stage,purpose,registry,roles:ADMIN_ROLES,permissions:stage==='set-agents-parent'?{change:'Set parent only; no role grants'}:{grantee:checked.controller,bitmap:ADMIN_ROLES,roles:['REGISTRAR','SET_PARENT','UNREGISTER','RENEW','SET_SUBREGISTRY','SET_RESOLVER','corresponding role administration','transfer administration'],upgradeRoles:false,runtimeSignerGrants:[]},controller:checked.controller,transaction:{from:account,to,data,value:'0x0',chainId:'0x'+checked.chainId.toString(16)}};
}
export async function registrationEffect({client,plan,anchors,blockNumber,checkpointHash}){
 const state=await registrationSnapshot({client,trust:plan.trust,anchors,blockNumber,checkpointHash}),read=(address,functionName,args=[])=>client.readContract({address,abi,functionName,args,blockNumber});
 const native=await artifacts(),name=p.names(plan.trust.org,plan.trust.label),record=await nativeData({client,universal:plan.trust.universal,abi:native.UniversalResolverV2.abi,name:name.agent,key:p.KEY,blockNumber}),recordId=await client.readContract({address:plan.trust.resolver,abi:native.PermissionedResolverImpl.abi,functionName:'getRecordId',args:[name.agentNode],blockNumber});
 p.need(p.eq(record.resolver,plan.trust.resolver)&&p.eq(record.raw,plan.expectedPolicy.raw)&&p.eq(recordId,plan.expectedPolicy.recordId),'Registration changed the reviewed policy resolver, bytes or record ID');
 if(['deploy-agents-registry','set-agents-parent'].includes(plan.stage)){
  p.need(p.eq(await read(anchors.factory,'verifyContract',[plan.registry]),anchors.implementation),'Confirmed transaction did not create the expected official registry');
  p.need(await read(plan.registry,'hasRootRoles',[ADMIN_ROLES,plan.controller]),'Confirmed registry controller differs from the reviewed grant');
  if(plan.stage==='set-agents-parent'){const [parent,label]=await read(plan.registry,'getParent');p.need(p.eq(parent,state.organizationRegistry)&&label==='agents','Confirmed registry parent differs from the reviewed binding');}
 }else if(plan.stage==='register-agents')p.need(state.namespace&&state.namespace.status===2&&p.eq(state.namespaceRegistry,plan.registry),'Agents namespace registration is not confirmed');
 else p.need(state.status==='registered','Requester registration is not confirmed');return state;
}
