// A timeout or missing receipt is never proof that a wallet request failed.
export async function revertedTransaction(client, intent, {chainId, confirmations=2, retry=false}={}) {
 if (!intent?.hash) throw Error('Recover the original transaction hash before retrying');
 if (await client.getChainId()!==chainId) throw Error('Wrong RPC chain');
 const [receipt,tx]=await Promise.all([client.getTransactionReceipt({hash:intent.hash}),client.getTransaction({hash:intent.hash})]);
 const same=(a,b)=>String(a).toLowerCase()===String(b).toLowerCase();
 if(receipt.status!=='reverted'||!same(receipt.transactionHash,intent.hash)||!same(tx.from,intent.account)||!same(tx.to,intent.to)||tx.input!==intent.data||tx.value!==0n||Number(tx.chainId)!==chainId||tx.nonce!==Number(intent.nonce))throw Error('A matching reverted transaction is required');
 const [block,height,latest]=await Promise.all([client.getBlock({blockNumber:receipt.blockNumber}),client.getBlockNumber(),client.getTransactionCount({address:intent.account,blockTag:'latest'})]);
 if(!same(block.hash,receipt.blockHash)||height<receipt.blockNumber+BigInt(confirmations-1)||latest<=Number(intent.nonce))throw Error('Failure is not yet canonically confirmed; recheck the original transaction');
 if(retry&&await client.getTransactionCount({address:intent.account,blockTag:'pending'})!==latest)throw Error('This wallet has another pending transaction; reconcile it before retrying');
 return {transactionHash:receipt.transactionHash,blockNumber:receipt.blockNumber,blockHash:receipt.blockHash,status:'reverted',gasUsed:receipt.gasUsed,effectiveGasPrice:receipt.effectiveGasPrice,feeWei:receipt.gasUsed*receipt.effectiveGasPrice};
}
