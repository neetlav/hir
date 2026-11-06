// Two extra reads across one authority check. Never retry a write, signature or login challenge.
const methods=['getChainId','getBlock','getCode','readContract'];
function causes(error){const result=[];for(let e=error;e&&!result.includes(e);e=e.cause)result.push(e);return result;}
function transient(error){
 const chain=causes(error);
 if(chain.some(e=>['ContractFunctionRevertedError','ExecutionRevertedError'].includes(e.name)))return false;
 return chain.some(e=>['TimeoutError','SocketClosedError','BlockNotFoundError'].includes(e.name)||
  e.name==='ResourceNotFoundRpcError'&&/block not found|unknown block|header not found/i.test(e.details??e.message??'')||
  e.name==='HttpRequestError'&&(e.status===undefined||[408,429].includes(e.status)||e.status>=500));
}
export function authorityReads(client){
 let remaining=2;const reads={...client};
 for(const method of methods)if(typeof client[method]==='function')reads[method]=async(...args)=>{
  for(;;)try{return await client[method](...args);}catch(error){
   if(!remaining||!transient(error))throw error;
   remaining--;await new Promise(resolve=>setTimeout(resolve,250));
  }
 };
 return reads;
}
