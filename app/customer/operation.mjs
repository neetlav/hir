import {AsyncLocalStorage} from 'node:async_hooks';
export const operations=new AsyncLocalStorage();
export const checkOperation=()=>operations.getStore()?.();
