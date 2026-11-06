import test from 'node:test';import assert from 'node:assert/strict';
import {watchWallet,walletMatches} from '../public/wallet-connection.mjs';
const account='0x00000000000000000000000000000000000000aA',other='0x00000000000000000000000000000000000000bb';
function wallet(){const listeners=new Map(),requests=[];return{listeners,requests,on(event,fn){if(!listeners.has(event))listeners.set(event,new Set());listeners.get(event).add(fn);},removeListener(event,fn){listeners.get(event)?.delete(fn);},emit(event,value){for(const fn of [...listeners.get(event)??[]])fn(value);},async request({method}){requests.push(method);return method==='eth_accounts'?[account]:'0xaa36a7';}};}
test('duplicate account and Sepolia notifications preserve the connection without wallet prompts',()=>{
 const provider=wallet(),changes=[],stop=watchWallet(provider,event=>changes.push(event),{account});
 for(let i=0;i<3;i++){provider.emit('accountsChanged',[account.toLowerCase(),other]);provider.emit('chainChanged','0xaa36a7');provider.emit('chainChanged',11155111);}
 assert.deepEqual(changes,[]);assert.deepEqual(provider.requests,[]);assert.equal(provider.listeners.get('accountsChanged').size,1);stop();assert.equal(provider.listeners.get('accountsChanged').size,0);
});
test('a changed or locked account, wrong chain and disconnect invalidate once and detach listeners',()=>{
 for(const [event,value]of [['accountsChanged',[other]],['accountsChanged',[]],['chainChanged','0x1'],['disconnect',{code:4900}]]){const provider=wallet(),changes=[];watchWallet(provider,e=>changes.push(e),{account});provider.emit(event,value);provider.emit(event,value);assert.deepEqual(changes,[event]);for(const handlers of provider.listeners.values())assert.equal(handlers.size,0);}
});
test('API connection checks still read the current wallet account and network',async()=>{
 const provider=wallet();assert.equal(await walletMatches(provider,account),true);assert.equal(await walletMatches(provider,other),false);assert.equal(await walletMatches(provider,account,1),false);assert.equal(provider.requests.includes('eth_requestAccounts'),false);
});
