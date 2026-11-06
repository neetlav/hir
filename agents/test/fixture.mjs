import hre from 'hardhat';
import {readFile} from 'node:fs/promises';
import {createPublicClient,createWalletClient,custom,defineChain,encodeFunctionData,zeroAddress} from 'viem';
import {privateKeyToAccount,generatePrivateKey} from 'viem/accounts';
import * as p from '../src/protocol.mjs';
export async function fixture(){
 if(hre.config.networks.hardhatMainnet?.type!=='edr-simulated'||hre.config.networks.hardhatMainnet?.forking?.enabled)throw Error('Isolated local EVM required');
 const connection=await hre.network.connect({network:'hardhatMainnet',override:{throwOnTransactionFailures:false}}),provider=connection.provider;
 const chain=defineChain({id:31337,name:'Agents isolated tests',nativeCurrency:{name:'ETH',symbol:'ETH',decimals:18},rpcUrls:{default:{http:['http://unused.local']}}});
 const transport=custom({request:r=>provider.request(r)},{retryCount:0}),client=createPublicClient({chain,transport,cacheTime:0,ccipRead:false}),wallet=createWalletClient({chain,transport});
 if(await client.getChainId()!==31337)throw Error('Never use test keys outside local EVM');
 const [admin,requester,receiver,other]=Array.from({length:4},()=>privateKeyToAccount(generatePrivateKey()));
 for(const account of [admin,requester,receiver,other])await provider.request({method:'hardhat_setBalance',params:[account.address,'0x3635c9adc5dea00000']});
 const artifacts=Object.fromEntries(await Promise.all(['LabelStore','RootRegistry','ETHRegistry','PermissionedResolverImpl','UniversalResolverV2','VerifiableFactory'].map(async n=>[n,JSON.parse(await readFile(new URL('../../vendor/ens-native/'+n+'.json',import.meta.url)))])));
 const deploy=async(a,args=[])=>{const hash=await wallet.deployContract({abi:a.abi,bytecode:a.bytecode,args,account:admin}),r=await client.waitForTransactionReceipt({hash});if(r.status!=='success')throw Error('Local deploy reverted');return{address:r.contractAddress,abi:a.abi};};
 const send=async(c,functionName,args=[],account=admin)=>{const hash=await wallet.writeContract({...c,functionName,args,account}),r=await client.waitForTransactionReceipt({hash});if(r.status!=='success')throw Error('Reverted '+functionName);return r;};
 const read=(c,functionName,args=[])=>client.readContract({...c,functionName,args});
 const normal=[0n,4n,8n,12n,16n,20n,24n,36n,120n,124n].reduce((x,b)=>x|(1n<<b),0n),roles=normal|(normal<<128n)|(1n<<156n);
 const labels=await deploy(artifacts.LabelStore,[zeroAddress]),root=await deploy(artifacts.RootRegistry,[labels.address,admin.address,roles]),registry=await deploy(artifacts.ETHRegistry,[labels.address,admin.address,roles]),factory=await deploy(artifacts.VerifiableFactory),impl=await deploy(artifacts.PermissionedResolverImpl,[admin.address]),universal=await deploy(artifacts.UniversalResolverV2,[root.address,zeroAddress,root.address]);
 const expiry=(await client.getBlock()).timestamp+100000n;await send(root,'register',['eth',admin.address,registry.address,zeroAddress,roles,expiry+100000n]);
 const resolverRoles=(1n<<24n)|(1n<<152n)|(1n<<124n)|(1n<<252n)|(1n<<28n)|(1n<<156n),init=encodeFunctionData({abi:impl.abi,functionName:'initialize',args:[[{account:admin.address,roleBitmap:resolverRoles}],[]]});
 const address=await read(factory,'predictProxyAddress',[admin.address,1n]);await send(factory,'deployProxy',[impl.address,1n,init]);const resolver={address,abi:impl.abi};
 await send(registry,'register',['agents-only',admin.address,zeroAddress,resolver.address,roles,expiry]);
 const org='agents-only.eth',n=p.names(org),state=await read(registry,'getState',[BigInt(p.textHash('agents-only'))]);
 const policy={version:1,chainId:31337n,orgNode:n.orgNode,agentNode:n.agentNode,controller:admin.address,ownershipResource:state.resource,resolver:resolver.address,generation:p.textHash('isolated-agents-generation'),requester:requester.address,receiver:receiver.address,action:p.ACTION,priceTable:p.TABLE,validAfter:0n,validUntil:expiry-1n,maxCredits:50};
 const trust={...policy,org,universal:universal.address,registry:registry.address};
 const configure=(value=p.encodePolicy(policy))=>send(resolver,'setData',[p.wire(n.agent),p.KEY,value]);await configure();
 return{connection,provider,client,wallet,admin,requester,receiver,other,registry,resolver,universal,policy,trust,n,deploy,send,read,configure};
}
