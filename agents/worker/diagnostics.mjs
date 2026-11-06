// Never retain raw RPC errors: they can contain URLs, credentials, calldata or
// signed evidence. These allowlisted facts identify the failing backend path.
export function chainDiagnostic(error,operation,id=crypto.randomUUID()){
 const causes=[],seen=new Set();let category='chain-service-unavailable';
 for(let e=error;e&&!seen.has(e)&&causes.length<8;e=e.cause){
  seen.add(e);const message=String(e.message??'')+' '+String(e.details??'');
  if(/too many subrequests/i.test(message))category='subrequest-limit';
  else if(category==='chain-service-unavailable'){
   if(e.status===429||/rate limit|too many requests/i.test(message))category='rpc-rate-limit';
   else if(/block not found|unknown block|header not found/i.test(message))category='rpc-block-unavailable';
   else if(e.name==='TimeoutError'||/timeout|timed out/i.test(message))category='rpc-timeout';
   else if(/insufficient funds|insufficient.*gas balance/i.test(message))category='insufficient-gas-balance';
   else if(['ContractFunctionRevertedError','ExecutionRevertedError'].includes(e.name)||/execution reverted/i.test(message))category='contract-reverted';
  }
  const safe=value=>typeof value==='string'&&/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(value)?value:undefined;
  causes.push({name:safe(e.name)??'Error',...(Number.isSafeInteger(e.code)?{code:e.code}:{}),...(Number.isInteger(e.status)&&e.status>=100&&e.status<=599?{status:e.status}:{}),...(safe(e.functionName)?{functionName:e.functionName}:{})});
 }
 if(category==='chain-service-unavailable'&&causes.some(c=>c.name==='EstimateGasExecutionError'))category='gas-estimate-failed';
 return{id,operation,category,causes};
}
