import {encodeAbiParameters,decodeAbiParameters,keccak256,stringToHex,hashTypedData} from 'viem';
import {normalize,namehash,packetToBytes} from 'viem/ens';
export const CONFIG_KEY='hir.invoice.config.v2',RECORD_KEY='hir.invoice.record';

export const policyFields=[['version','uint32'],['namespace','bytes32'],['ledger','address'],['chainId','uint256'],['controller','address'],['ownershipResource','uint256'],['resolver','address'],['generation','bytes32'],['issuer','address'],['paymentChainId','uint256'],['token','address'],['recipient','address']].map(([name,type])=>({name,type}));
export const invoiceFields=[['scope','bytes32'],['invoiceId','bytes32'],['revision','uint32'],['previousDigest','bytes32'],['pdfHash','bytes32'],['detailsHash','bytes32'],['amount','uint256'],['paymentChainId','uint256'],['token','address'],['recipient','address'],['policyHash','bytes32'],['deadline','uint64']].map(([name,type])=>({name,type}));
const tuple=components=>[{type:'tuple',components}];
export const encodePolicy=p=>encodeAbiParameters(tuple(policyFields),[p]);
export const decodePolicy=p=>decodeAbiParameters(tuple(policyFields),p)[0];
export const decodeInvoice=p=>decodeAbiParameters(tuple(invoiceFields),p)[0];
export const hash=keccak256;
export const textHash=s=>keccak256(stringToHex(s));
export const wire=name=>'0x'+Buffer.from(packetToBytes(normalize(name))).toString('hex');
export function organization(name){const n=normalize(name);if(n!==name||!/^[a-z0-9-]{1,63}\.eth$/.test(n))throw Error('Use a normalized ASCII .eth organization identity');return n;}
export const namespace=name=>'invoices.'+organization(name);
export const namespaceNode=name=>namehash(namespace(name));
export function scope(p){return keccak256(encodeAbiParameters([{type:'uint256'},{type:'address'},{type:'bytes32'},{type:'address'},{type:'uint256'},{type:'address'},{type:'bytes32'}],[BigInt(p.chainId),p.ledger,p.namespace,p.controller,BigInt(p.ownershipResource),p.resolver,p.generation]));}
export const typedInvoice=(ledger,chainId,message)=>({domain:{name:'HIR Invoice',version:'1',chainId:Number(chainId),verifyingContract:ledger},types:{Invoice:invoiceFields},primaryType:'Invoice',message});
export const digest=(ledger,chainId,v)=>hashTypedData(typedInvoice(ledger,chainId,v));
export function hydrate(v,fields=invoiceFields){return Object.fromEntries(fields.map(f=>[f.name,f.type.startsWith('uint')?BigInt(v[f.name]):v[f.name]]));}
export function json(v){return JSON.stringify(v,(_,x)=>typeof x==='bigint'?x.toString():x,2)+'\n';}

export function invoiceName(org,label){const name=label+'.'+namespace(org);if(normalize(name)!==name||!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))throw Error('Canonical invoice label required');return name;}
export const invoiceId=(org,label)=>namehash(invoiceName(org,label));
export const encodePointer=(ledger,scope,id)=>encodeAbiParameters([{type:'uint32'},{type:'address'},{type:'bytes32'},{type:'bytes32'}],[1,ledger,scope,id]);
export const decodePointer=value=>decodeAbiParameters([{type:'uint32'},{type:'address'},{type:'bytes32'},{type:'bytes32'}],value);
