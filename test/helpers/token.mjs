import solc from 'solc';
import {readFileSync} from 'node:fs';
export function compileToken(){
  const name='test/contracts/LocalDemoToken.sol';
  const input={language:'Solidity',sources:{[name]:{content:readFileSync(name,'utf8')}},settings:{optimizer:{enabled:true,runs:200},evmVersion:'cancun',outputSelection:{'*':{'*':['abi','evm.bytecode.object']}}}};
  const output=JSON.parse(solc.compile(JSON.stringify(input),{import:p=>({contents:readFileSync('node_modules/'+p,'utf8')})}));
  const errors=output.errors?.filter(x=>x.severity==='error');if(errors?.length)throw Error(errors.map(x=>x.formattedMessage).join('\n'));
  const c=output.contracts[name].LocalDemoToken;return {abi:c.abi,bytecode:'0x'+c.evm.bytecode.object};
}
