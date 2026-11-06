import {readFile} from 'node:fs/promises';
import {createPublicClient,http} from 'viem';
import {verify} from './verifier.mjs';import {compile} from './compile.mjs';import {json,need} from './protocol.mjs';

const args=process.argv.slice(2),options={};
for(let i=0;i<args.length;i+=2){need(['--trust','--bundle','--rpc'].includes(args[i])&&args[i+1]&&!options[args[i]],'Use --trust <expected.json> --bundle <evidence.json> --rpc <archive-RPC-URL>');options[args[i]]=args[i+1];}
need(options['--trust']&&options['--bundle']&&options['--rpc'],'Explicit independent trust, evidence and archive RPC are required');
const config=JSON.parse(await readFile(options['--trust'],'utf8')),download=JSON.parse(await readFile(options['--bundle'],'utf8')),build=compile();
need(config.runtimeCodeHash===build.runtimeCodeHash,'Independent contract build differs from selected trust anchor');
const client=createPublicClient({transport:http(options['--rpc'],{timeout:12000,retryCount:0}),cacheTime:0,ccipRead:false});
const result=await verify({client,config,build,bundle:download.bundle,sealSignature:download.sealSignature,anchor:download.anchor});
console.log(json(result));if(result.status!=='verified')process.exitCode=1;
