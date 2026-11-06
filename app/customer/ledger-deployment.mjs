import {keccak256} from 'viem';
const same=(a,b)=>String(a).toLowerCase()===String(b).toLowerCase();
export async function ledgerDeploymentStatus({client,manifest,hash}){
 if(await client.getChainId()!==manifest.chainId)throw Error('Wrong RPC network');
 const code=await client.getCode({address:manifest.expectedAddress});let receipt;
 if(hash){if(!/^0x[a-fA-F0-9]{64}$/.test(hash))throw Error('Enter a public transaction hash');let tx;try{tx=await client.getTransaction({hash});receipt=await client.getTransactionReceipt({hash});}catch(error){if(['TransactionNotFoundError','TransactionReceiptNotFoundError'].includes(error.name))return{manifest,status:'pending',hash};throw error;}
  if(!same(tx.from,manifest.operator)||tx.to!==null||tx.input!==manifest.tx.data||tx.value!==0n||Number(tx.chainId)!==manifest.chainId||tx.nonce!==manifest.nonce)throw Error('This transaction does not match the reviewed ledger deployment');
  if(receipt.status!=='success')return{manifest,status:'reverted',hash};if(!same(receipt.contractAddress,manifest.expectedAddress))throw Error('Deployment address differs from the reviewed manifest');if(await client.getBlockNumber()<receipt.blockNumber+1n)return{manifest,status:'pending',hash};
 }
 if(code&&code!=='0x'){if(keccak256(code)!==manifest.runtimeCodeHash)throw Error('Unsupported code at the expected deployment address');return{manifest,status:'confirmed',...(receipt?{receipt:{transactionHash:receipt.transactionHash,blockNumber:receipt.blockNumber,gasUsed:receipt.gasUsed,feeWei:receipt.gasUsed*receipt.effectiveGasPrice}}:{})};}
 const [latest,pending]=await Promise.all(['latest','pending'].map(blockTag=>client.getTransactionCount({address:manifest.operator,blockTag})));
 return{manifest,status:latest===manifest.nonce&&pending===manifest.nonce?'ready':'review-required',message:latest===manifest.nonce&&pending===manifest.nonce?'Review this one platform deployment in the operator wallet.':'The operator nonce changed or has another pending transaction. A refreshed reviewed deployment manifest is required; no transaction request will be made.'};
}
