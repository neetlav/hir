import * as p from './protocol.mjs';
export function canonical(value){
 if(value===null||typeof value==='boolean'||typeof value==='string')return JSON.stringify(value);
 if(typeof value==='bigint')return JSON.stringify(value.toString());
 if(typeof value==='number'){p.need(Number.isSafeInteger(value),'Only safe integer numbers allowed');return JSON.stringify(value);}
 if(Array.isArray(value))return'['+value.map(canonical).join(',')+']';
 p.need(value&&Object.getPrototypeOf(value)===Object.prototype,'Plain JSON required');
 return'{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
}
export const objectHash=value=>p.textHash(canonical(value));
export function validateInput(input){
 p.need(input&&Object.keys(input).sort().join(',')==='label,series','Expected only label and series');
 p.need(typeof input.label==='string'&&input.label.length>0&&input.label.length<=100,'Dataset label required (up to 100 characters)');
 p.need(Array.isArray(input.series)&&input.series.length>0&&input.series.length<=128,'Dataset must contain 1–128 integers');
 p.need(input.series.every(x=>Number.isSafeInteger(x)&&Math.abs(x)<=1000000),'Dataset integers must be within ±1,000,000');
 return input;
}
export function analyze(input,mode){
 validateInput(input);p.price(mode);
 const xs=input.series.map(BigInt),sum=xs.reduce((a,b)=>a+b,0n),sorted=[...xs].sort((a,b)=>a<b?-1:a>b?1:0),count=BigInt(xs.length);
 const out={algorithm:'hir-analysis-v1',label:input.label,mode:mode===0?'basic':'extended',count:count.toString(),sum:sum.toString(),minimum:sorted[0].toString(),maximum:sorted.at(-1).toString(),mean:{numerator:sum.toString(),denominator:count.toString()}};
 if(mode===1){const mid=Math.floor(xs.length/2);out.median=xs.length%2?{numerator:sorted[mid].toString(),denominator:'1'}:{numerator:(sorted[mid-1]+sorted[mid]).toString(),denominator:'2'};out.sumSquares=xs.reduce((a,b)=>a+b*b,0n).toString();}
 return out;
}
export const SAMPLE={label:'Illustrative response times in minutes',series:[12,18,9,24,15,21,10,17]};
