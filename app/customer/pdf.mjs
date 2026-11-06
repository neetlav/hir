// Reuses the preserved app/pdf.mjs renderer with customer imports and accurate cancellation wording.
import {readFile} from 'node:fs/promises';
import {PDFDocument} from 'pdfkit';
import {create as openFont} from 'fontkit';
import QRCode from 'qrcode';
import {money,readableDate} from './format.mjs';
import {pdfEnvironment} from '../pdf-network.mjs';

export const PDF_RENDERER='PDFKit 0.20.2 - direct Node PDF, embedded Inter';
const colors={ink:'#191919',petrol:'#164E57',pink:'#E72A96',muted:'#595755',line:'#E1E1E0',warm:'#FAF9F7',pale:'#FEEAF0',berry:'#9E1B68'};
const tooLong=()=>Error('This invoice is too long for the supported one-page PDF. Shorten the customer reference or payment terms; nothing has been issued.');
let fontPromise;
function fonts(fontBytes){
 if(fontBytes)return Promise.resolve([400,500,600].map((weight,i)=>({weight,bytes:Buffer.from(fontBytes[i]),coverage:openFont(Buffer.from(fontBytes[i]))})));
 if(!fontPromise){const pending=Promise.all([400,500,600].map(async weight=>{const bytes=await readFile(new URL(`../../node_modules/@fontsource/inter/files/inter-latin-${weight}-normal.woff`,import.meta.url));return {weight,bytes,coverage:openFont(bytes)};}));fontPromise=pending;pending.catch(()=>{if(fontPromise===pending)fontPromise=null;});}
 return fontPromise;
}
function supported(text,loaded){
 for(const char of String(text).replaceAll('\r\n','\n')){
  if(char==='\n')continue;
  const point=char.codePointAt(0);
  if(point<32||point===127||/\p{Cf}/u.test(char)||loaded.some(font=>!font.coverage.hasGlyphForCodePoint(point)))throw Error(`The invoice contains a character not supported by the embedded Inter fonts (U+${point.toString(16).toUpperCase().padStart(4,'0')}). Replace it before issuing; nothing has been issued.`);
 }
}

// Measure first. No text clipping, ellipsis or fixed text-height limits.
function layout(doc,data,compact){
 const environment=pdfEnvironment(data.chainId);
 const margin=compact?31.5:34.5,width=doc.page.width-2*margin,body=compact?9.5:10.5,gap=compact?12:18,ops=[];
 const left=margin,right=doc.page.width-margin;
 function text(value,x,y,w,size=body,weight=400,color=colors.ink,extra={}){
  const content=String(value).replaceAll('\r\n','\n'),options={width:w,lineGap:size*.25,paragraphGap:0,features:{liga:false},...extra};
  doc.font('Inter'+weight).fontSize(size);
  const height=doc.heightOfString(content,options);
  if(!Number.isFinite(height)||w<=0||x<margin-.1||x+w>right+.1)throw tooLong();
  ops.push({kind:'text',content,x,y,w,size,weight,color,options,height});return height;
 }
 const line=y=>ops.push({kind:'line',x:left,y,w:width});
 const label=(value,x,y,w)=>text(value.toUpperCase(),x,y,w,7.7,400,colors.muted,{characterSpacing:.35});
 let y=margin;
 text('HIR',left,y,80,22,600,colors.petrol);text('.',left+40,y,15,22,600,colors.pink);
 text('INVOICE RECORD',left,y+29,150,7.3,400,colors.muted,{characterSpacing:1});
 ops.push({kind:'box',x:right-242,y:y+1,w:242,h:23,r:4,color:colors.pale});
 text(environment.banner,right-234,y+7,226,7.2,500,colors.berry);
 y+=47;line(y);y+=compact?16:22;
 y+=text('Invoice '+data.invoiceNumber,left,y,width,compact?19.5:24,600)+4;
 y+=text(data.supplier+' · Version '+data.revision,left,y,width,10.5,400,colors.muted)+gap;
 const col=(width-18)/2,gridY=y;
 const a=label('Supplier ENS Name',left,y,col);
 const org=text(data.orgName,left,y+a+4,col,body,500);
 const note=text('Customer approval of this supplier is independent of this PDF.',left,y+a+org+8,col,7.7,400,colors.muted);
 const b=label('Customer reference',left+col+18,y,col);
 const customer=text(data.customer,left+col+18,y+b+4,col,body,500);
 y=gridY+Math.max(a+org+note+8,b+customer+4)+gap;
 const codeLabel=label('Invoice Authenticity Code',left,y,width);
 y+=codeLabel+4;
 y+=text(data.name,left,y,width,compact?9:9.5,500,colors.petrol,{link:data.link})+4;
 y+=text('Use this code with the supplier ENS name to verify the attached invoice.',left,y,width,7.7,400,colors.muted)+gap;
 const dateLabel=label('Issued date',left,y,col);label('Due date',left+col+18,y,col);
 const issued=text(readableDate(data.issuedDate),left,y+dateLabel+4,col,body,500);
 const due=text(readableDate(data.dueDate),left+col+18,y+dateLabel+4,col,body,500);
 y+=dateLabel+4+Math.max(issued,due)+gap;
 const totalStart=y,pad=compact?13:16,inside=width-2*pad;
 const totalLabel=label('Invoice amount · '+data.symbol+' ('+environment.asset+')',left+pad,y+pad,inside);
 const amountY=y+pad+totalLabel+5,amountHeight=text(money(data.amount)+' '+data.symbol,left+pad,amountY,inside,compact?22:24,600,colors.petrol);
 const unitsY=amountY+amountHeight+4,unitsHeight=text(data.units+' integer base units · '+data.decimals+' decimals',left+pad,unitsY,inside,8,400,colors.muted);
 const totalHeight=unitsY+unitsHeight+pad-totalStart;
 ops.splice(ops.length-3,0,{kind:'box',x:left,y:totalStart,w:width,h:totalHeight,r:9,color:colors.warm,border:colors.line});
 y=totalStart+totalHeight+gap;
 for(const [key,value]of [['Receiving wallet',data.recipient],['Asset contract',data.token],['Network',environment.network],['Authorized issuer',data.signer]]){
  const h=Math.max(label(key,left,y,110),text(value,left+120,y,width-120,8.3,500));y+=h+(compact?8:12);line(y);y+=compact?5:7;
 }
 y+=compact?3:6;y+=text('Terms',left,y,width,13.5,600)+5;
 y+=text(data.terms,left,y,width,body,400)+gap;
 line(y);y+=compact?13:17;
 const qrSize=72,checkX=left+qrSize+16,checkW=width-qrSize-16,verifyY=y;
 ops.push({kind:'qr',x:left,y,size:qrSize,link:data.link});
 let checkY=y;checkY+=label('Invoice Authenticity Code · Verify this invoice',checkX,checkY,checkW)+5;
 checkY+=text(data.name,checkX,checkY,checkW,8.3,500)+4;
 checkY+=text(data.link,checkX,checkY,checkW,8.1,400,colors.petrol,{link:data.link})+6;
 checkY+=text('Choose your expected supplier independently. Earlier authorization can remain after a correction. Cancellation is not supported by this record.',checkX,checkY,checkW,8.1);
 y=Math.max(verifyY+qrSize,checkY)+(compact?10:14);
 y+=text('This final PDF is recorded without embedding its signature into itself. Verification evidence is provided separately. This document does not approve a payment.',left,y,width,6.9,400,colors.muted)+4;
 for(const [name,value]of [['Record identifier',data.recordId],['Customer reference hash',data.customerRef],['Terms hash',data.termsHash]])y+=text(name+': '+value,left,y,width,6.6,400,colors.muted)+1;
 y+=compact?9:13;
 const footer=text(data.invoiceNumber+' · '+data.name,left,y,width-35,7.1,400,colors.muted);
 text('1 / 1',right-27,y,27,7.1,400,colors.muted);y+=footer;
 return {ops,bottom:y,limit:doc.page.height-margin,compact};
}

export async function createPDF(data,{fontBytes,origin}={}){
 const loaded=await fonts(fontBytes);
 for(const value of Object.values(data))if(typeof value==='string')supported(value,loaded);
 if(!/^0x[0-9a-f]{64}$/i.test(data.recordId??''))throw Error('Invoice record identity is required before PDF creation.');
 const url=new URL(data.link);if(origin?url.origin!==origin||url.protocol!=='https:':url.protocol!=='http:'||url.hostname!=='127.0.0.1')throw Error('PDF verification links must stay on the configured app origin.');
 const qr=QRCode.create(data.link,{errorCorrectionLevel:'M'});
 const doc=new PDFDocument({autoFirstPage:false,size:'A4',margins:{top:0,bottom:0,left:0,right:0},bufferPages:true,font:null,info:{Title:`Invoice ${data.invoiceNumber} - version ${data.revision}`,Author:data.supplier,Creator:'HIR direct invoice renderer',Producer:'PDFKit 0.20.2'}});
 const chunks=[];const done=new Promise((resolve,reject)=>{doc.on('data',chunk=>chunks.push(chunk));doc.once('end',()=>resolve(Buffer.concat(chunks)));doc.once('error',reject);});done.catch(()=>{});
 try{
  for(const font of loaded)doc.registerFont('Inter'+font.weight,font.bytes);
  doc.addPage();let plan=layout(doc,data,false);if(plan.bottom>plan.limit)plan=layout(doc,data,true);if(plan.bottom>plan.limit)throw tooLong();
  for(const op of plan.ops){
   if(op.kind==='text'){doc.font('Inter'+op.weight).fontSize(op.size).fillColor(op.color).text(op.content,op.x,op.y,op.options);if(doc.y>op.y+op.height+.2)throw tooLong();}
   else if(op.kind==='line')doc.lineWidth(.7).strokeColor(colors.line).moveTo(op.x,op.y).lineTo(op.x+op.w,op.y).stroke();
   else if(op.kind==='box'){doc.roundedRect(op.x,op.y,op.w,op.h,op.r).fillColor(op.color);if(op.border)doc.fillAndStroke(op.color,op.border);else doc.fill();}
   else if(op.kind==='qr'){
    const count=qr.modules.size,cell=op.size/(count+8);doc.rect(op.x,op.y,op.size,op.size).fill('#FFFFFF');
    for(let row=0;row<count;row++)for(let col=0;col<count;col++)if(qr.modules.get(row,col))doc.rect(op.x+(col+4)*cell,op.y+(row+4)*cell,cell,cell).fill(colors.petrol);
    doc.link(op.x,op.y,op.size,op.size,op.link);
   }
  }
  if(doc.bufferedPageRange().count!==1)throw tooLong();
  doc.end();return await done;
 }catch(error){doc.destroy(error);await done.catch(()=>{});throw error;}
}
