import * as p from '../src/protocol.mjs';
export class Repository {
 constructor(storage){this.storage=storage;this.sql=storage.sql;for(const table of ['agents_metadata','agents_jobs','agents_sessions'])this.sql.exec(`CREATE TABLE IF NOT EXISTS ${table} (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);this.prune();}
 table(key){return key.startsWith('session:')?'agents_sessions':key.startsWith('job:')?'agents_jobs':'agents_metadata';}
 prune(){this.sql.exec("DELETE FROM agents_sessions WHERE json_extract(value,'$.expires') <= ?",Date.now());}
 get(key,fallback=null){const row=this.sql.exec(`SELECT value FROM ${this.table(key)} WHERE key=?`,key).toArray()[0];return row?JSON.parse(row.value):fallback;}
 put(key,value){const text=p.json(value);p.need(new TextEncoder().encode(text).length<1500000,'Record exceeds the bounded storage size');if(key.startsWith('session:'))this.prune();this.sql.exec(`INSERT INTO ${this.table(key)}(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`,key,text);return value;}
 create(key,value){p.need(this.get(key)===null,'Immutable record or execution claim already exists');const text=p.json(value);p.need(new TextEncoder().encode(text).length<1500000,'Record exceeds the bounded storage size');this.sql.exec(`INSERT INTO ${this.table(key)}(key,value) VALUES(?,?)`,key,text);return value;}
 list(prefix){return this.sql.exec(`SELECT key,value FROM ${this.table(prefix)} WHERE key >= ? AND key < ? ORDER BY key`,prefix,prefix+'\uffff').toArray().map(r=>({key:r.key,value:JSON.parse(r.value)}));}
 transaction(fn){return this.storage.transactionSync(fn);}
}
export class JobStore {
 constructor(db){this.db=db;}
 valid(id){p.need(/^0x[0-9a-f]{64}$/.test(id),'Invalid request ID');}
 async load(id){this.valid(id);return this.db.get('job:'+id);}
 async append(id,state){this.valid(id);return this.db.transaction(()=>{const before=this.db.get('job:'+id);if(before?.sealed){for(const key of ['envelope','decision','outcome','sealed'])p.need(p.json(before[key])===p.json(state[key]),'Sealed evidence cannot be changed');}return this.db.put('job:'+id,state);});}
 async claim(id){this.valid(id);return this.db.transaction(()=>this.db.create('execution:'+id,{claimedAt:Date.now()}));}
 async ids(){return this.db.list('job:').map(r=>r.key.slice(4));}
}
