import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';

export const stringify=v=>JSON.stringify(v,(_,x)=>typeof x==='bigint'?x.toString():x,2)+'\n';
export async function atomic(file,value,replace=rename){
  await mkdir(path.dirname(file),{recursive:true});const tmp=file+'.tmp';await writeFile(tmp,stringify(value));
  // Windows scanners can briefly hold a journal file. Retry the same atomic replacement;
  // never delete the prior file, acknowledge an unpersisted write, or discard the pending one.
  for(let attempt=0;;attempt++){
    try{await replace(tmp,file);return;}
    catch(error){if(!['EPERM','EACCES','EBUSY'].includes(error.code)||attempt>=6)throw error;await delay(25*2**attempt);}
  }
}
export async function load(file,fallback){try{return JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw e;}}
