// One extra read per verification, never a write or a restart of the evidence checks.
const methods=['getChainId','getBlock','getCode','getTransactionReceipt','getTransaction','getLogs','readContract'];
const transientNames=new Set(['TimeoutError','SocketClosedError','BlockNotFoundError','TransactionNotFoundError','TransactionReceiptNotFoundError']);
function causes(error){const found=[];for(let e=error;e&&!found.includes(e);e=e.cause)found.push(e);return found;}
function transient(error){
 const chain=causes(error);
 if(chain.some(e=>['ContractFunctionRevertedError','ExecutionRevertedError'].includes(e.name)))return false;
 return chain.some(e=>transientNames.has(e.name)||e.name==='HttpRequestError'&&(e.status===undefined||[408,429].includes(e.status)||e.status>=500)||e.name==='RpcRequestError'&&[-32002,-32005].includes(e.code));
}
class VerificationReadError extends Error{
 constructor(cause,operation,retried){super('Blockchain evidence read unavailable',{cause});this.operation=operation;this.retried=retried;}
 walk(predicate){return causes(this).find(predicate);}
}
export function verificationReads(client){
 let remaining=1;
 const reads={...client};
 for(const operation of methods)if(typeof client[operation]==='function')reads[operation]=async(...args)=>{
  let retried=false;
  for(;;)try{return await client[operation](...args);}catch(error){
   if(remaining&&transient(error)){remaining--;retried=true;await new Promise(resolve=>setTimeout(resolve,250));continue;}
   throw new VerificationReadError(error,operation,retried);
  }
 };
 return reads;
}
export function verificationDiagnostic(error){
 if(!(error instanceof VerificationReadError))return{errorType:'VerificationError'};
 const names=new Set([...transientNames,'HttpRequestError','RpcRequestError','ContractFunctionRevertedError','ExecutionRevertedError']);
 return{operation:error.operation,errorType:causes(error).map(e=>e.name).find(name=>names.has(name))||'EvidenceReadError',retried:error.retried};
}
