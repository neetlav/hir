import {decodeEventLog,keccak256} from 'viem';
export const equal=(a,b)=>typeof a==='string'&&typeof b==='string'?a.toLowerCase()===b.toLowerCase():a===b;
export class Mismatch extends Error {}
export const requireMatch=(condition,message)=>{if(!condition)throw new Mismatch(message);};
export const logMatchesReceipt=(log,receipt)=>equal(log.blockHash,receipt.blockHash)&&log.blockNumber===receipt.blockNumber&&equal(log.transactionHash,receipt.transactionHash)&&log.transactionIndex===receipt.transactionIndex&&Number.isSafeInteger(log.logIndex)&&log.logIndex>=0&&!log.removed;
export const rawLogEqual=(a,b)=>equal(a.address,b.address)&&equal(a.data,b.data)&&a.topics.length===b.topics.length&&a.topics.every((x,i)=>equal(x,b.topics[i]))&&equal(a.blockHash,b.blockHash)&&a.blockNumber===b.blockNumber&&equal(a.transactionHash,b.transactionHash)&&a.transactionIndex===b.transactionIndex&&a.logIndex===b.logIndex&&!a.removed&&!b.removed;
/** Chain/RPC observations, not a light-client or finality proof. All trust inputs come from the caller. */
export async function authenticateEvent({client,address,runtimeCodeHash,abi,eventABI,bundle,snapshot}){
 requireMatch(bundle&&/^0x[0-9a-fA-F]{64}$/.test(bundle.transactionHash)&&Number.isSafeInteger(bundle.logIndex)&&bundle.logIndex>=0,'receiptSelectorRequired');
 const receipt=await client.getTransactionReceipt({hash:bundle.transactionHash});requireMatch(equal(receipt.transactionHash,bundle.transactionHash)&&receipt.status==='success'&&receipt.blockNumber<=snapshot.number,'unsuccessfulOrWrongReceipt');
 const acceptedBlock=await client.getBlock({blockNumber:receipt.blockNumber}),code=await client.getCode({address,blockNumber:receipt.blockNumber});requireMatch(code&&code!=='0x'&&equal(keccak256(code),runtimeCodeHash),'acceptanceCodeMismatch');
 requireMatch(equal(acceptedBlock.hash,receipt.blockHash)&&acceptedBlock.transactions.some(t=>equal(typeof t==='string'?t:t.hash,bundle.transactionHash)),'noncanonicalReceipt');
 const tx=await client.getTransaction({hash:bundle.transactionHash});requireMatch(equal(tx.hash,bundle.transactionHash)&&equal(tx.blockHash,receipt.blockHash)&&tx.blockNumber===receipt.blockNumber&&tx.transactionIndex===receipt.transactionIndex,'transactionReceiptMismatch');
 const candidates=receipt.logs.filter(l=>l.logIndex===bundle.logIndex);requireMatch(candidates.length===1&&equal(candidates[0].address,address)&&logMatchesReceipt(candidates[0],receipt),'receiptLogMismatch');const log=candidates[0];
 const logs=await client.getLogs({address,event:eventABI,fromBlock:receipt.blockNumber,toBlock:receipt.blockNumber,strict:true});requireMatch(logs.some(l=>rawLogEqual(l,log)),'receiptLogNotInCanonicalLogs');
 const event=decodeEventLog({abi,data:log.data,topics:log.topics,strict:true}).args;
 return {receipt,acceptedBlock,log,event};
}
