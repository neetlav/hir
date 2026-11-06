// Only watches connection state. It never requests a signature or transaction.
export function watchWallet(provider,onChange,{account,chainId=11155111}={}){
 let active=true;const events=['accountsChanged','chainChanged','disconnect'];
 const stop=()=>{if(!active)return;active=false;for(const [event,fn] of listeners){if(provider.removeListener)provider.removeListener(event,fn);else provider.off?.(event,fn);}};
 const listeners=events.map(event=>[event,value=>{if(!active)return;if(event==='accountsChanged'&&account&&Array.isArray(value)&&value[0]?.toLowerCase()===account.toLowerCase())return;if(event==='chainChanged'&&account&&Number(value)===chainId)return;stop();onChange(event);}]);
 for(const [event,fn] of listeners)provider.on?.(event,fn);return stop;
}
export async function walletMatches(provider,account,chainId=11155111){
 const [accounts,chain]=await Promise.all([provider.request({method:'eth_accounts'}),provider.request({method:'eth_chainId'})]);
 return Array.isArray(accounts)&&accounts[0]?.toLowerCase()===account.toLowerCase()&&Number(chain)===chainId;
}
