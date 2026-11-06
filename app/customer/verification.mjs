import {discover,verifyHistorical} from '../../scripts/invoice-record/discovery.mjs';import * as p from '../../scripts/invoice-record/protocol.mjs';
import {Mismatch} from '../../scripts/shared/chain-evidence.mjs';
import {verificationReads,verificationDiagnostic} from '../../scripts/shared/verification-reads.mjs';
export async function verifyReceived({client,platform,name,expectedOrg,bytes}){
 client=verificationReads(client);
 const anchor={chainId:platform.chainId,ledger:platform.ledger,runtimeCodeHash:platform.runtimeCodeHash,expectedOrg:p.organization(expectedOrg)};
 try{
  const args={client,abi:platform.abi,universal:platform.universal,universalABI:platform.universalABI,resolverABI:platform.resolverABI,anchor,name,documentBytes:bytes};let result=await discover(args);
  // Follow authenticated previous-digest links, never a HIR invoice database, for an older received PDF.
  let previous=result.invoice?.previousDigest;for(let i=0;bytes&&result.findings.documentIntegrity?.status==='fail'&&previous&&previous!=='0x'+'00'.repeat(32)&&i<32;i++){
   const a=await client.readContract({address:platform.ledger,abi:platform.abi,functionName:'accepted',args:[previous]});if(a[4]===0n)break;
   const event=platform.abi.find(x=>x.type==='event'&&x.name==='InvoiceAccepted'),logs=await client.getLogs({address:platform.ledger,event,args:{digest:previous},fromBlock:a[4],toBlock:a[4]});if(logs.length!==1)break;
   const old=await verifyHistorical({client,abi:platform.abi,anchor,name,documentBytes:bytes,bundle:{transactionHash:logs[0].transactionHash,logIndex:logs[0].logIndex}});if(old.findings.historicalAuthenticity?.status!=='pass')break;if(old.findings.documentIntegrity?.status==='pass'){old.discovery=result.discovery;result=old;break;}previous=old.invoice?.previousDigest;
  }
  result.capabilities={cancellation:false};return result;
 }catch(error){return{kind:'hir-customer-verification',safeToPay:'notAssessed',capabilities:{cancellation:false},findings:{verification:{status:error instanceof Mismatch?'fail':'unknown',code:error.message.includes('expected supplier')?'wrongExpectedSupplier':'evidenceUnavailableOrNameMismatch',message:error instanceof Mismatch?error.message:'Blockchain evidence could not be read. Please try verification again shortly.',...(error instanceof Mismatch?{}:{diagnostic:verificationDiagnostic(error)})}}};}
}
