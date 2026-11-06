import {mkdir,open,readFile,readdir} from 'node:fs/promises';
import path from 'node:path';import {json,need} from '../../src/protocol.mjs';
export class Store {
 constructor(root){need(typeof root==='string'&&root.length>0,'Explicit disposable test directory required');this.root=path.resolve(root);}
 directory(id){need(/^0x[0-9a-f]{64}$/.test(id),'Invalid request ID');return path.join(this.root,'jobs',id);}
 async load(id){let files;try{files=(await readdir(this.directory(id))).filter(x=>/^\d{6}\.json$/.test(x)).sort();}catch(e){if(e.code==='ENOENT')return null;throw e;}if(!files.length)throw Error('Incomplete durable job; automatic replay refused');const raw=await readFile(path.join(this.directory(id),files.at(-1)),'utf8');return JSON.parse(raw);}
 async append(id,state){const dir=this.directory(id);await mkdir(dir,{recursive:true});const files=(await readdir(dir)).filter(x=>/^\d{6}\.json$/.test(x)).sort(),index=files.length?Number(files.at(-1).slice(0,6))+1:0;need(index<1000000,'Job history limit');const handle=await open(path.join(dir,String(index).padStart(6,'0')+'.json'),'wx');try{await handle.writeFile(json(state));await handle.sync();}finally{await handle.close();}return state;}
 async claim(id){await mkdir(this.directory(id),{recursive:true});try{const handle=await open(path.join(this.directory(id),'execution.claim'),'wx');await handle.writeFile('Claimed before execution; never automatically reset.\n');await handle.sync();await handle.close();}catch(e){if(e.code==='EEXIST')throw Error('Execution previously claimed; resume persisted outcome or report indeterminate, never rerun');throw e;}}
 async ids(){try{return(await readdir(path.join(this.root,'jobs'))).filter(x=>/^0x[0-9a-f]{64}$/.test(x));}catch(e){if(e.code==='ENOENT')return[];throw e;}}
}
