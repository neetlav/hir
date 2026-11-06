import {mkdir,copyFile,cp} from 'node:fs/promises';
await mkdir('dist/assets',{recursive:true});await cp('app/customer/public','dist/assets',{recursive:true});
await copyFile('app/customer/format.mjs','dist/assets/format.mjs');await copyFile('docs/INVOICE-APPLICATION.md','dist/assets/invoice-help.txt');
