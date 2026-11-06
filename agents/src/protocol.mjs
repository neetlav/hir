import {encodeAbiParameters,decodeAbiParameters,keccak256,stringToHex,hashTypedData,zeroHash} from 'viem';
import {normalize,namehash,packetToBytes} from 'viem/ens';
export const KEY='hir.agents.identity-policy.v1';
export const ACTION=keccak256(stringToHex('hir.analysis'));
export const TABLE=keccak256(stringToHex('hir-analysis-v1:basic=40;extended=80'));
export const fields=entries=>entries.map(([name,type])=>({name,type}));
export const policyFields=fields([['version','uint32'],['chainId','uint256'],['orgNode','bytes32'],['agentNode','bytes32'],['controller','address'],['ownershipResource','uint256'],['resolver','address'],['generation','bytes32'],['requester','address'],['receiver','address'],['action','bytes32'],['priceTable','bytes32'],['validAfter','uint64'],['validUntil','uint64'],['maxCredits','uint32']]);
export const encodePolicy=p=>encodeAbiParameters([{type:'tuple',components:policyFields}],[p]);
export const decodePolicy=raw=>{const p=decodeAbiParameters([{type:'tuple',components:policyFields}],raw)[0];if(encodePolicy(p)!==raw.toLowerCase())throw Error('Noncanonical policy bytes');return p;};
export const hash=keccak256;
export const textHash=s=>hash(stringToHex(s));
export const json=v=>JSON.stringify(v,(_,x)=>typeof x==='bigint'?x.toString():x,2)+'\n';
export const eq=(a,b)=>String(a).toLowerCase()===String(b).toLowerCase();
export const need=(condition,message)=>{if(!condition)throw Error(message);};
export function names(org,label='requester'){need(typeof org==='string'&&org===normalize(org)&&/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.eth$/.test(org),'Enter a normalized existing .eth organization, using a second-level organization name');need(typeof label==='string'&&/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label),'Use a label of 1–63 lowercase letters, digits or internal hyphens');const agent=label+'.agents.'+org;return{org,label,agent,orgNode:namehash(org),agentNode:namehash(agent)};}
export const wire=name=>'0x'+Buffer.from(packetToBytes(normalize(name))).toString('hex');
export function price(mode){need(mode===0||mode===1,'Unknown analysis mode');return mode===0?40:80;}
export const parametersHash=mode=>hash(encodeAbiParameters([{type:'bytes32'},{type:'uint8'}],[TABLE,mode]));
export const requestFields=fields([['requestId','bytes32'],['agentNode','bytes32'],['requester','address'],['receiver','address'],['action','bytes32'],['inputHash','bytes32'],['parametersHash','bytes32'],['mode','uint8'],['priceTable','bytes32'],['credits','uint32'],['policyHash','bytes32'],['generation','bytes32'],['createdAt','uint64'],['expiresAt','uint64']]);
export const decisionFields=fields([['requestId','bytes32'],['requestDigest','bytes32'],['policyHash','bytes32'],['checkpointHash','bytes32'],['checkpointNumber','uint256'],['assessed','uint8'],['accepted','bool'],['reasonHash','bytes32'],['decidedAt','uint64']]);
export const outcomeFields=fields([['requestId','bytes32'],['decisionDigest','bytes32'],['status','uint8'],['outputHash','bytes32'],['completedAt','uint64']]);
export const sealFields=fields([['requestDigest','bytes32'],['decisionDigest','bytes32'],['outcomeDigest','bytes32'],['bundleHash','bytes32']]);
export const typed=(config,type,message)=>({domain:{name:'HIR Agents',version:'1',chainId:Number(config.chainId),verifyingContract:config.evidence},primaryType:type,types:{[type]:({Request:requestFields,Decision:decisionFields,Outcome:outcomeFields,Seal:sealFields})[type]},message});
export const digest=(config,type,message)=>hashTypedData(typed(config,type,message));
export const hydrate=(message,fs)=>Object.fromEntries(fs.map(f=>[f.name,f.type.startsWith('uint')?BigInt(message[f.name]):message[f.name]]));
export {zeroHash};
