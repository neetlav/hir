import {readFileSync} from 'node:fs';import {mkdir,writeFile} from 'node:fs/promises';import {fileURLToPath} from 'node:url';
import solc from 'solc';import * as p from './protocol.mjs';
const root=new URL('../../',import.meta.url),packageRoot=new URL('../',import.meta.url);
// Canonical LF input keeps the build hash stable across Git newline settings.
export function compile(){
 const file='agents/contracts/HirAgentsEvidence.sol',sourceHashes={};
 const load=key=>{const s=readFileSync(new URL(key,root),'utf8').replace(/\r\n/g,'\n');sourceHashes[key]=p.textHash(s);return s;};
 const settings={optimizer:{enabled:true,runs:200},viaIR:true,evmVersion:'cancun',outputSelection:{'*':{'*':['abi','evm.bytecode.object','evm.deployedBytecode.object','metadata']}}};
 const out=JSON.parse(solc.compile(JSON.stringify({language:'Solidity',sources:{[file]:{content:load(file)}},settings}),{import:key=>{try{const logical='node_modules/'+key,content=readFileSync(new URL(logical,packageRoot),'utf8').replace(/\r\n/g,'\n');sourceHashes[logical]=p.textHash(content);return{contents:content}}catch{return{error:'Missing import '+key}}}}));
 for(const e of out.errors??[])if(e.severity==='error')throw Error(e.formattedMessage);
 const c=out.contracts[file].HirAgentsEvidence;
 return{compiler:solc.version(),settings,sourceHashes,abi:c.abi,bytecode:'0x'+c.evm.bytecode.object,runtime:'0x'+c.evm.deployedBytecode.object,runtimeCodeHash:p.hash('0x'+c.evm.deployedBytecode.object),metadata:JSON.parse(c.metadata)};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const build=compile();await mkdir(new URL('../build/',import.meta.url),{recursive:true});await writeFile(new URL('../build/HirAgentsEvidence.json',import.meta.url),p.json(build));console.log(p.json({compiler:build.compiler,runtimeBytes:(build.runtime.length-2)/2,runtimeCodeHash:build.runtimeCodeHash}));}
