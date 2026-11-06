import {encodeFunctionData,parseAbi} from 'viem';import {namehash,normalize} from 'viem/ens';
import {verifyInvoice} from './verifier.mjs';import {equal as eq,requireMatch as need} from '../shared/chain-evidence.mjs';import * as p from './protocol.mjs';
export class UnsupportedInvoiceDeployment extends Error {}
export async function verifyHistorical({client,abi,anchor,bundle,documentBytes,name}){
 const result=await verifyInvoice({client,abi,anchor,bundle,documentBytes});
 if(result.invoice){const label=name?.split('.')[0];need(name===p.invoiceName(anchor.expectedOrg,label),'Invoice name is outside expected supplier');need(eq(result.invoice.invoiceId,namehash(name)),'Signed invoice does not bind this ENS name');if(anchor.requireRegistration&&result.invoice){try{await client.readContract({address:anchor.ledger,abi,functionName:'registration',args:[p.wire(anchor.expectedOrg),label],blockNumber:result.checkedAt?.blockNumber});result.findings.currentRegistration={status:'pass',code:'registeredNameActive'};}catch(error){const reverted=error.walk?.(e=>e.name==='ContractFunctionRevertedError');result.findings.currentRegistration={status:reverted?'fail':'unknown',code:reverted?'registeredNameChanged':'registeredNameReadUnavailable'};}}result.reference={name,namespace:p.namespace(anchor.expectedOrg),invoiceId:result.invoice.invoiceId,independentENSLeafRecord:true,individualTokenRequired:!!anchor.requireRegistration};}
 return result;
}
export async function discover({client,abi,universalABI,resolverABI,universal,anchor,name,documentBytes}){
 need(name===normalize(name),'Canonical name required');const label=name.split('.')[0];need(name===p.invoiceName(anchor.expectedOrg,label),'Invoice name is outside expected supplier');
 const snapshot=await client.getBlock(),at={blockNumber:snapshot.number};
 const calldata=encodeFunctionData({abi:parseAbi(['function data(bytes32,string) view returns(bytes)']),functionName:'data',args:['0x'+'00'.repeat(32),p.RECORD_KEY]});
 const [answer,resolver]=await client.readContract({address:universal,abi:universalABI,functionName:'resolveWithGateways',args:[p.wire(name),calldata,[]],...at});
 const [value]=await import('viem').then(({decodeAbiParameters})=>decodeAbiParameters([{type:'bytes'}],answer));const [version,ledger,scope,id]=p.decodePointer(value);
 need(version===1&&eq(id,namehash(name)),'ENS pointer has wrong schema or signed name');if(!eq(ledger,anchor.ledger))throw new UnsupportedInvoiceDeployment('This application supports only the registered-name invoice deployment. This reference belongs to a different ledger.');
 const rid=await client.readContract({address:resolver,abi:resolverABI,functionName:'getRecordId',args:[namehash(name)],...at}),bound=await client.readContract({address:ledger,abi,functionName:'recordIds',args:[scope,id],...at});need(rid>0n&&rid===bound,'Record bundle was relinked or aliased');
 const head=await client.readContract({address:ledger,abi,functionName:'heads',args:[scope,id],...at});const accepted=await client.readContract({address:ledger,abi,functionName:'accepted',args:[head[0]],...at});need(accepted[4]>0n,'Pointer has no accepted evidence');
 const event=abi.find(x=>x.type==='event'&&x.name==='InvoiceAccepted');const logs=await client.getLogs({address:ledger,event,args:{scope,invoiceId:id,digest:head[0]},fromBlock:accepted[4],toBlock:accepted[4]});need(logs.length===1,'Acceptance event unavailable or ambiguous');
 const bundle={transactionHash:logs[0].transactionHash,logIndex:logs[0].logIndex};const result=await verifyHistorical({client,abi,anchor,bundle,documentBytes,name});
 result.discovery={status:'pass',method:'native ENSv2 full-name resolution and exact-block ledger event lookup',name,resolver,recordId:rid,pointer:value,blockNumber:snapshot.number,usesHIRDatabase:false};return result;
}
