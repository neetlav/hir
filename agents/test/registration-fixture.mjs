import {readFile} from 'node:fs/promises';import {encodeFunctionData,zeroAddress} from 'viem';import * as p from '../src/protocol.mjs';
export async function sharedRegistration(f){
 const artifact=JSON.parse(await readFile(new URL('../vendor/ens-registration/UserRegistryImpl.json',import.meta.url))),impl=await f.deploy(artifact,[f.labels.address,zeroAddress,f.admin.address]);
 async function deploy(salt,parent,label){const address=await f.read(f.factory,'predictProxyAddress',[f.admin.address,salt]),data=encodeFunctionData({abi:artifact.abi,functionName:'initialize',args:[[{account:f.admin.address,roleBitmap:f.roles}]]});await f.send(f.factory,'deployProxy',[impl.address,salt,data]);const r={address,abi:artifact.abi};await f.send(r,'setParent',[parent,label]);return r;}
 const organization=await deploy(200n,f.registry.address,'agents-only');await f.send(f.registry,'setSubregistry',[f.policy.ownershipResource,organization.address]);
 const anchors={factory:f.factory.address,implementation:impl.address,factoryCodeHash:p.hash(await f.client.getCode({address:f.factory.address})),implementationCodeHash:p.hash(await f.client.getCode({address:impl.address}))};return{organization,anchors,artifact,deploy};
}
