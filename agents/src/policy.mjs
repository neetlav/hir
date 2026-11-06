import {randomBytes} from 'node:crypto';
import {encodeFunctionData,isAddress,zeroAddress} from 'viem';
import {artifacts,nativeData} from './ens.mjs';
import * as p from './protocol.mjs';

// Read-only authority inspection. A public address is not proof of caller control.
export async function inspectOrganization({client,org,label='requester',account,chainId,universal,registry,operatorOnly=false}){
 const names=p.names(org,label);for(const address of [account,universal,registry])p.need(isAddress(address)&&!p.eq(address,zeroAddress),'Explicit nonzero authority addresses required');
 p.need(Number.isSafeInteger(chainId)&&chainId>0&&await client.getChainId()===chainId,'Wrong ENS RPC chain');
 const a=await artifacts(),block=await client.getBlock(),at={blockNumber:block.number};
 const read=(address,abi,functionName,args=[])=>client.readContract({address,abi,functionName,args,...at});
 p.need(await read(universal,a.UniversalResolverV2.abi,'isENSv2'),'Native ENSv2 interface required');
 const root=await read(universal,a.UniversalResolverV2.abi,'ROOT_REGISTRY');
 p.need(p.eq(await read(root,a.RootRegistry.abi,'getSubregistry',['eth']),registry),'Unexpected authoritative ETH registry');
 const state=await read(registry,a.ETHRegistry.abi,'getState',[BigInt(p.textHash(org.split('.')[0]))]);
 p.need(state.status===2&&state.expiry>block.timestamp,'Existing organization is inactive or expired');
 const authority={org,account,chainId,universal,registry,controller:state.latestOwner,ownershipResource:state.resource,organizationExpiry:state.expiry,blockNumber:block.number,blockHash:block.hash,timestamp:block.timestamp};
 if(operatorOnly&&p.eq(state.latestOwner,account)){p.need(p.eq((await client.getBlock(at)).hash,block.hash),'Organization authority checkpoint changed during inspection');return{...authority,operator:true,canPublish:false};}
 const resolver=await read(registry,a.ETHRegistry.abi,'getResolver',[org.split('.')[0]]);p.need(!p.eq(resolver,zeroAddress),'Authoritative resolver required');
 const [rootData,keyData]=await Promise.all([0n,BigInt(p.textHash(p.KEY))].map(resource=>read(resolver,a.PermissionedResolverImpl.abi,'hasRoles',[resource,1n<<24n,account])));
 if(operatorOnly){p.need(p.eq((await client.getBlock(at)).hash,block.hash),'Organization authority checkpoint changed during inspection');return{...authority,resolver,operator:rootData||keyData,canPublish:rootData||keyData};}
 const record=await nativeData({client,universal,abi:a.UniversalResolverV2.abi,name:names.agent,key:p.KEY,...at});
 p.need(p.eq(record.resolver,resolver),'Agent routes through an unexpected resolver');
 const recordId=await read(resolver,a.PermissionedResolverImpl.abi,'getRecordId',[names.agentNode]),codeHashes={};
 for(const [key,address] of Object.entries({universal,registry,resolver})){const code=await client.getCode({address,...at});p.need(code&&code!=='0x','ENS dependency code unavailable');codeHashes[key]=p.hash(code);}
 p.need(p.eq((await client.getBlock(at)).hash,block.hash),'Organization authority checkpoint changed during inspection');
 return{org,label,name:names.agent,account,chainId,universal,registry,resolver,controller:state.latestOwner,ownershipResource:state.resource,organizationExpiry:state.expiry,blockNumber:block.number,blockHash:block.hash,timestamp:block.timestamp,recordId,raw:record.raw,codeHashes,operator:p.eq(state.latestOwner,account)||rootData||keyData,canPublish:rootData||keyData};
}

// Prepares exactly one initial native data record; it never sends a transaction or loads keys.
export async function preparePolicy({client,org,label='requester',account,chainId,universal,registry,requester,receiver,evidence,runtimeCodeHash}){
 const checked=await inspectOrganization({client,org,label,account,chainId,universal,registry});
 p.need(checked.canPublish,'Wallet lacks root or Agents-key SET_DATA permission');
 p.need(checked.recordId===0n&&checked.raw==='0x','Initial agent name is occupied; existing records are never overwritten');
 for(const address of [requester,receiver,evidence])p.need(isAddress(address)&&!p.eq(address,zeroAddress),'Explicit nonzero signer and evidence addresses required');
 p.need(!p.eq(requester,receiver)&&!p.eq(requester,checked.controller)&&!p.eq(receiver,checked.controller),'Dedicated distinct requester and receiver required');
 const code=await client.getCode({address:evidence,blockNumber:checked.blockNumber});
 p.need(code&&code!=='0x'&&p.eq(p.hash(code),runtimeCodeHash),'Evidence runtime differs from the independently selected build');
 const a=await artifacts();
 for(const address of [requester,receiver])for(const resource of [0n,BigInt(p.textHash(p.KEY))])for(const role of [1n<<24n,1n<<152n,1n<<28n,1n<<156n])p.need(!await client.readContract({address:checked.resolver,abi:a.PermissionedResolverImpl.abi,functionName:'hasRoles',args:[resource,role,address],blockNumber:checked.blockNumber}),'Agent signers must not have resolver administration permissions');
 const n=p.names(org,label),end=checked.timestamp+604800n;
 const policy={version:1,chainId:BigInt(chainId),orgNode:n.orgNode,agentNode:n.agentNode,controller:checked.controller,ownershipResource:checked.ownershipResource,resolver:checked.resolver,generation:'0x'+randomBytes(32).toString('hex'),requester,receiver,action:p.ACTION,priceTable:p.TABLE,validAfter:checked.timestamp,validUntil:end<checked.organizationExpiry?end:checked.organizationExpiry,maxCredits:50};
 const raw=p.encodePolicy(policy),data=encodeFunctionData({abi:a.PermissionedResolverImpl.abi,functionName:'setData',args:[p.wire(n.agent),p.KEY,raw]});
 await client.call({account,to:checked.resolver,data});
 p.need(p.eq((await client.getBlock({blockNumber:checked.blockNumber})).hash,checked.blockHash),'Preparation checkpoint changed');
 return{policy,raw,policyHash:p.hash(raw),trust:{chainId,org,label,controller:checked.controller,ownershipResource:checked.ownershipResource,resolver:checked.resolver,generation:policy.generation,requester,receiver,universal,registry,codeHashes:checked.codeHashes,evidence,runtimeCodeHash,policyHash:p.hash(raw)},transaction:{from:account,to:checked.resolver,data,value:'0x0',chainId:'0x'+chainId.toString(16)},checkpoint:{blockNumber:checked.blockNumber,blockHash:checked.blockHash}};
}
