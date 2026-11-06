// Two extra reads across one authority check. Never retry a write, signature or login challenge.
const methods=['getChainId','getBlock','getCode','readContract'];
const fallbackKey=Symbol('authority-read-fallback');
export const withAuthorityFallback=(client,fallback)=>({...client,[fallbackKey]:fallback});
function causes(error){const result=[];for(let e=error;e&&!result.includes(e);e=e.cause)result.push(e);return result;}
function unavailableBlock(error){const chain=causes(error);return !chain.some(e=>['ContractFunctionRevertedError','ExecutionRevertedError'].includes(e.name))&&chain.some(e=>e.name==='BlockNotFoundError'||e.name==='ResourceNotFoundRpcError'&&/block not found|unknown block|header not found/i.test(e.details??e.message??''));}
function transient(error){
 const chain=causes(error);
 if(chain.some(e=>['ContractFunctionRevertedError','ExecutionRevertedError'].includes(e.name)))return false;
 return chain.some(e=>['TimeoutError','SocketClosedError','BlockNotFoundError'].includes(e.name)||
  e.name==='ResourceNotFoundRpcError'&&/block not found|unknown block|header not found/i.test(e.details??e.message??'')||
  e.name==='HttpRequestError'&&(e.status===undefined||[408,429].includes(e.status)||e.status>=500));
}
export function authorityReads(client){
 let remaining=2,chainId,checkpoint,recovery;const blocks=new Map(),fallback=client[fallbackKey],reads={...client};
 const observe=(method,value)=>{if(method==='getChainId')chainId=value;if(method==='getBlock'&&value?.number!==undefined&&value.hash)blocks.set(String(value.number),value.hash);return value;};
 const need=(ok,message)=>{if(!ok)throw Error(message);};
 async function recover(method,args){
  const number=args[0]?.blockNumber,hash=number===undefined?null:blocks.get(String(number));
  need(fallback&&chainId!==undefined&&hash,'A verified authority checkpoint is required for RPC recovery');
  if(!recovery){checkpoint={number,hash};recovery=(async()=>{need(await fallback.getChainId()===chainId,'Authority fallback RPC chain differs');const block=await fallback.getBlock({blockNumber:number});need(block.number===number&&block.hash?.toLowerCase()===hash.toLowerCase(),'Authority fallback checkpoint differs');})();}
  await recovery;need(number===checkpoint.number&&hash===checkpoint.hash,'Authority fallback cannot replace the selected checkpoint');
  const result=await fallback[method](...args),block=method==='getBlock'?result:await fallback.getBlock({blockNumber:number});
  need(block.number===number&&block.hash?.toLowerCase()===hash.toLowerCase(),'Authority fallback checkpoint changed');return result;
 }
 for(const method of methods)if(typeof client[method]==='function')reads[method]=async(...args)=>{
  if(recovery&&args[0]?.blockNumber===checkpoint.number)return recover(method,args);
  for(;;)try{return observe(method,await client[method](...args));}catch(error){
   if(!remaining||!transient(error)){if(fallback&&unavailableBlock(error)&&args[0]?.blockNumber!==undefined&&blocks.has(String(args[0].blockNumber)))return recover(method,args);throw error;}
   remaining--;await new Promise(resolve=>setTimeout(resolve,250));
  }
 };
 return reads;
}
