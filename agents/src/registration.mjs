import {zeroAddress,isAddress} from 'viem';
import abi from '../config/registration-abi.json' with {type:'json'};
import {lookupPolicy} from './ens.mjs';import * as p from './protocol.mjs';
export {abi as registrationABI};
export const REGISTRAR=1n,SET_PARENT=1n<<8n;
const normal=REGISTRAR|SET_PARENT|(1n<<12n)|(1n<<16n)|(1n<<20n)|(1n<<24n);
export const ADMIN_ROLES=normal|(normal<<128n)|(1n<<156n);
const dangerous=ADMIN_ROLES|(1n<<124n)|(1n<<252n);
export const explorer=name=>'https://sepolia.explorer.ens.domains/'+encodeURIComponent(name);

export async function registrationSnapshot({client,trust,anchors=trust.registration,blockNumber,checkpointHash}){
 p.names(trust.org,trust.label??'requester');p.need(anchors,'Independently expected ENS registration anchors are required');
 for(const signer of [trust.requester,trust.receiver])p.need(isAddress(signer)&&!p.eq(signer,zeroAddress),'Independently expected runtime signer addresses are required');
 p.need(await client.getChainId()===Number(trust.chainId),'Wrong registration RPC chain');
 const block=await client.getBlock(blockNumber===undefined?{}:{blockNumber:BigInt(blockNumber)}),at={blockNumber:block.number};
 if(checkpointHash)p.need(p.eq(block.hash,checkpointHash),'Registration checkpoint is not canonical');
 const read=(address,functionName,args=[])=>client.readContract({address,abi,functionName,args,...at});
 const root=await read(trust.universal,'ROOT_REGISTRY');p.need(p.eq(await read(root,'getSubregistry',['eth']),trust.registry),'Registration hierarchy differs from the Universal Resolver deployment');
 await Promise.all([[anchors.factory,anchors.factoryCodeHash],[anchors.implementation,anchors.implementationCodeHash]].map(async([address,hash])=>p.need(p.eq(p.hash(await client.getCode({address,...at})),hash),'Official ENS registration dependency changed')));
 const organization=await read(trust.registry,'getState',[BigInt(p.textHash(trust.org.split('.')[0]))]);
 p.need(organization.status===2&&organization.expiry>block.timestamp&&p.eq(organization.latestOwner,trust.controller)&&p.eq(organization.resource,trust.ownershipResource),'Organization registration binding changed');
 p.need(p.eq(await read(trust.registry,'getResolver',[trust.org.split('.')[0]]),trust.resolver),'Organization resolver changed');
 const organizationRegistry=await read(trust.registry,'getSubregistry',[trust.org.split('.')[0]]),result={schema:1,status:'organization-prerequisite',org:trust.org,label:trust.label??'requester',organizationRegistry,controller:trust.controller,resolver:trust.resolver,organizationExpiry:organization.expiry,blockNumber:block.number,blockHash:block.hash,timestamp:block.timestamp,explorer:{namespace:explorer('agents.'+trust.org),requester:explorer(p.names(trust.org,trust.label??'requester').agent)}};
 async function registry(address,parent,label){
  const [implementation,[actualParent,actualLabel],controllerRoles,...signerRoles]=await Promise.all([read(anchors.factory,'verifyContract',[address]),read(address,'getParent'),read(address,'hasRootRoles',[REGISTRAR,trust.controller]),...[trust.requester,trust.receiver].filter(Boolean).map(signer=>read(address,'roles',[0n,signer]))]);
  p.need(p.eq(implementation,anchors.implementation),'Registry is not the expected official UserRegistry proxy');p.need(p.eq(actualParent,parent)&&actualLabel===label,'Registry parent binding changed');
  p.need(controllerRoles,'Organization controller cannot administer this registry');
  for(const roles of signerRoles)p.need((roles&dangerous)===0n,'Runtime signer has registry administration rights');
 }
 async function tokenRoles(address,resource){const roles=await Promise.all([trust.requester,trust.receiver].filter(Boolean).map(signer=>read(address,'roles',[resource,signer])));for(const bitmap of roles)p.need((bitmap&dangerous)===0n,'Runtime signer has registered-name administration rights');}
 if(p.eq(organizationRegistry,zeroAddress))return result;
 await registry(organizationRegistry,trust.registry,trust.org.split('.')[0]);
 result.status='namespace-unregistered';const namespace=await read(organizationRegistry,'getState',[BigInt(p.textHash('agents'))]);result.namespace=namespace;
 if(namespace.status!==2||namespace.expiry<=block.timestamp)return result;
 p.need(p.eq(namespace.latestOwner,trust.controller)&&namespace.expiry<=organization.expiry,'Agents namespace ownership or expiry changed');
 await tokenRoles(organizationRegistry,namespace.resource);
 p.need(p.eq(await read(organizationRegistry,'getResolver',['agents']),trust.resolver),'Agents namespace resolver differs from the existing policy');
 result.namespaceRegistry=await read(organizationRegistry,'getSubregistry',['agents']);
 p.need(!p.eq(result.namespaceRegistry,zeroAddress),'Registered Agents namespace is missing its child registry; review before changing it');
 await registry(result.namespaceRegistry,organizationRegistry,'agents');
 result.status='requester-unregistered';const leaf=await read(result.namespaceRegistry,'getState',[BigInt(p.textHash(result.label))]);result.requester=leaf;
 if(leaf.status!==2||leaf.expiry<=block.timestamp)return result;
 p.need(p.eq(leaf.latestOwner,trust.controller)&&leaf.expiry<=namespace.expiry,'Requester registration ownership or expiry changed');
 await tokenRoles(result.namespaceRegistry,leaf.resource);
 p.need(p.eq(await read(result.namespaceRegistry,'getResolver',[result.label]),trust.resolver),'Requester resolver differs from the existing policy');
 result.status='registered';p.need(p.eq((await client.getBlock(at)).hash,block.hash),'Registration checkpoint changed');return result;
}
export async function lookupRegisteredPolicy(options){
 const policy=await lookupPolicy(options),registration=await registrationSnapshot({...options,blockNumber:policy.blockNumber,checkpointHash:policy.blockHash});
 p.need(registration.status==='registered','Register both Agents ENS names before starting a new exchange');return{...policy,registration};
}
