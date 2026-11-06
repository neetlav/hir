import {compile} from './compile.mjs';
const artifact=await compile();
console.log(JSON.stringify({compiler:artifact.compiler,creationBytes:(artifact.bytecode.length-2)/2,runtimeTemplateBytes:(artifact.runtimeTemplate.length-2)/2,contract:'HirInvoiceRecordLedger'}));
