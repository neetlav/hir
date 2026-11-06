import {readFile} from 'node:fs/promises';
import {encodeFunctionData,decodeAbiParameters,parseAbi,zeroHash,zeroAddress} from 'viem';
import * as p from './protocol.mjs';
const root=new URL('../../',import.meta.url);
export async function artifacts(){return Object.fromEntries(await Promise.all(['ETHRegistry','PermissionedResolverImpl','UniversalResolverV2','RootRegistry'].map(async n=>[n,JSON.parse(await readFile(new URL('vendor/ens-native/'+n+'.json',root)))])));}
export async function nativeData({client,universal,abi,name,key,blockNumber}){
 const data=encodeFunctionData({abi:parseAbi(['function data(bytes32,string) view returns(bytes)']),functionName:'data',args:[zeroHash,key]});
 const [answer,resolver]=await client.readContract({address:universal,abi,functionName:'resolveWithGateways',args:[p.wire(name),data,[]],blockNumber});
 return{raw:decodeAbiParameters([{type:'bytes'}],answer)[0],resolver};
}
export async function lookupPolicy({client,trust,blockNumber,checkpointHash,allowExpired=false}){
 const a=await artifacts();
 p.need(await client.getChainId()===Number(trust.chainId),'Wrong ENS RPC chain');
 const observedNumber=blockNumber===undefined?(await client.getBlockNumber({cacheTime:0}))-2n:BigInt(blockNumber);
 const block=await client.getBlock({blockNumber:observedNumber});
 if(checkpointHash)p.need(p.eq(block.hash,checkpointHash),'Policy checkpoint is not canonical');
 const at={blockNumber:block.number},n=p.names(trust.org,trust.label??'requester');
 for(const [key,address] of Object.entries({universal:trust.universal,registry:trust.registry,resolver:trust.resolver})){const code=await client.getCode({address,...at});p.need(code?.length>2,'ENS dependency code unavailable');if(trust.codeHashes?.[key])p.need(p.eq(p.hash(code),trust.codeHashes[key]),'ENS dependency bytecode changed: '+key);}
 const state=await client.readContract({address:trust.registry,abi:a.ETHRegistry.abi,functionName:'getState',args:[BigInt(p.textHash(trust.org.split('.')[0]))],...at});
 p.need(state.status===2&&state.expiry>block.timestamp,'Organization inactive or expired');
 p.need(p.eq(state.latestOwner,trust.controller)&&state.resource===BigInt(trust.ownershipResource),'Unexpected organization controller/resource');
 const routed=await client.readContract({address:trust.registry,abi:a.ETHRegistry.abi,functionName:'getResolver',args:[trust.org.split('.')[0]],...at});
 p.need(p.eq(routed,trust.resolver),'Organization resolver changed');
 const record=await nativeData({client,universal:trust.universal,abi:a.UniversalResolverV2.abi,name:n.agent,key:p.KEY,...at});
 p.need(p.eq(record.resolver,trust.resolver),'Agent resolves through unexpected resolver');
 p.need(record.raw!=='0x','Agent identity/policy absent');
 if(trust.policyHash)p.need(p.eq(p.hash(record.raw),trust.policyHash),'Published policy differs from the selected trusted context');
 const policy=p.decodePolicy(record.raw);
 for(const [key,expected] of Object.entries({version:1,chainId:trust.chainId,orgNode:n.orgNode,agentNode:n.agentNode,controller:trust.controller,ownershipResource:trust.ownershipResource,resolver:trust.resolver,generation:trust.generation,requester:trust.requester,receiver:trust.receiver,action:p.ACTION,priceTable:p.TABLE,maxCredits:50}))p.need(p.eq(policy[key],expected),'Unexpected policy '+key);
 p.need(!p.eq(policy.requester,zeroAddress)&&!p.eq(policy.receiver,zeroAddress)&&!p.eq(policy.requester,policy.receiver)&&!p.eq(policy.requester,policy.controller)&&!p.eq(policy.receiver,policy.controller),'Dedicated distinct runtime signers required');
 p.need(policy.validUntil<=state.expiry,'Policy outlives organization');
 if(!allowExpired)p.need(policy.validAfter<=block.timestamp&&policy.validUntil>block.timestamp,'Policy not valid at checkpoint');
 const rid=await client.readContract({address:trust.resolver,abi:a.PermissionedResolverImpl.abi,functionName:'getRecordId',args:[n.agentNode],...at});
 p.need(rid>0n,'Missing native agent record');
 if(trust.recordId!==undefined)p.need(rid===BigInt(trust.recordId),'Agent record relinked');
 p.need(p.eq((await client.getBlock(at)).hash,block.hash),'Policy checkpoint changed during lookup');
 return{policy,raw:record.raw,policyHash:p.hash(record.raw),name:n.agent,resolver:record.resolver,recordId:rid,blockNumber:block.number,blockHash:block.hash,timestamp:block.timestamp,source:'native ENSv2 Universal Resolver',usesHIRAuthorityAPI:false};
}
