import {AsyncLocalStorage} from 'node:async_hooks';
export const operations=new AsyncLocalStorage();
export const checkOperation=()=>operations.getStore()?.();
// Fresh per HTTP invocation; never retain authority across requests or cache writes.
export const requestReads=new AsyncLocalStorage();
export function readOnce(key,read){
 const scope=requestReads.getStore();
 if(!scope)return read();
 if(!scope.has(key))scope.set(key,Promise.resolve().then(read));
 return scope.get(key);
}
