// Test-only entry point: never referenced by production wrangler.jsonc.
import worker from '../worker/index.mjs';import {InvoiceState as ProductionState,platform,json} from '../worker/state.mjs';
export class InvoiceState extends ProductionState{async fetch(request){if(new URL(request.url).pathname==='/__test/storage')return new Response(json({metadata:[...this.repo.sql.exec('SELECT key,value FROM metadata')],sessions:[...this.repo.sql.exec('SELECT value FROM sessions')]}));return super.fetch(request);}}
export default {async fetch(request,env){Object.assign(platform,JSON.parse(env.TEST_PLATFORM));if(new URL(request.url).pathname==='/__test/storage')return env.INVOICE_STATE.get(env.INVOICE_STATE.idFromName('invoice-state-v1')).fetch(request);return worker.fetch(request,env);}};
