import {ledgerDeploymentStatus} from './ledger-deployment.mjs';
import {readFile} from 'node:fs/promises';
import {stringify} from './persistence.mjs';
export function createCustomerHandler({service,platform,baseURL,access,control,stop}){
const port=new URL(baseURL).port;
const send=(res,status,value,type='application/json')=>{res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'SAMEORIGIN','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; frame-src 'self' blob:; connect-src 'self'; frame-ancestors 'self'; base-uri 'none'; form-action 'self'"});res.end(Buffer.isBuffer(value)?value:type==='application/json'?stringify(value):value);};
async function body(req){const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>8*1024*1024)throw Error('Choose a PDF up to 5 MB');chunks.push(c);}return JSON.parse(Buffer.concat(chunks));}
return async(req,res)=>{try{
 if(req.headers.host!==`127.0.0.1:${port}`||req.headers.origin&&req.headers.origin!==baseURL)return send(res,403,{error:'Use the local HIR origin'});const u=new URL(req.url,baseURL);const s=access.cookie(req.headers.cookie);
 if(req.method==='POST'&&u.pathname==='/api/stop'){if(req.headers.origin!==baseURL||req.headers['x-hir-control']!==control)return send(res,403,{error:'Local process control required'});send(res,200,{stopping:true,historyPreserved:true});setImmediate(stop);return;}
 if(req.method==='POST'&&u.pathname.startsWith('/api/auth/')){if(!s||req.headers.origin!==baseURL||req.headers['x-hir-session']!==s.csrf)return send(res,403,{error:'Browser session and origin required'});const b=await body(req);if(u.pathname==='/api/auth/challenge')return send(res,200,access.challenge(s,b));if(u.pathname==='/api/auth/verify')return send(res,200,await access.verify(s,b));if(u.pathname==='/api/auth/logout'){access.logout(s);return send(res,200,{authenticated:false});}return send(res,404,{error:'Unknown authentication request'});}
 if(req.method==='POST'){
  if(req.headers.origin!==baseURL||(!s||req.headers['x-hir-session']!==s.csrf)||!String(req.headers['content-type']).startsWith('application/json'))return send(res,403,{error:'Local session and origin required'});const b=await body(req);
  if(u.pathname==='/api/organization')return send(res,200,await service.organization(b.org));
  if(u.pathname==='/api/capabilities')return send(res,200,await service.capabilities(b.org,b.account));
  if(['registration','registration/hash','registration/recheck','registration/rejected','setup','setup/dispatch','setup/receipt','setup/status','setup/rejected','draft','signature','publication','publication/hash','publication/rejected','publication/recheck'].includes(u.pathname.slice(5)))return send(res,200,await access.call(s,u.pathname.slice(5),b));
  if(u.pathname==='/api/verify')return send(res,200,await service.verify({name:b.name,expectedOrg:b.expectedOrg,bytes:b.pdfBase64?Buffer.from(b.pdfBase64,'base64'):undefined}));
  return send(res,404,{error:'Unknown invoice action'});
 }
 if(req.method!=='GET')return send(res,405,{error:'Method not supported'});
 if(u.pathname==='/api/session'){const current=s||access.create();res.setHeader('Set-Cookie',`hir_invoice_session=${current.id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=1800`);return send(res,200,{token:current.csrf,chainId:platform.chainId,ledger:platform.ledger,cancellationSupported:false,auth:access.public(current)});}
 if(u.pathname==='/api/overview')return send(res,200,{chainId:platform.chainId,records:(await access.workspace(s,s?.org)).records});
 if(u.pathname==='/api/setup/history')return send(res,200,access.setupHistory(s));
 if(u.pathname==='/api/setup/pending')return send(res,200,access.pendingSetup(s));
 if(u.pathname==='/api/workspace')return send(res,200,await access.workspace(s,u.searchParams.get('org')));
 if(u.pathname==='/api/ledger-deployment')return send(res,200,await ledgerDeploymentStatus({client:platform.deploymentClient,manifest:platform.deploymentManifest,hash:u.searchParams.get('hash')}));
 if(u.pathname==='/api/platform')return send(res,200,{chainId:platform.chainId,network:platform.chainId===11155111?'Ethereum Sepolia':'Unsupported network',asset:await service.asset(platform.defaultToken),registeredHierarchy:!!platform.registeredHierarchy});
 const screen=u.pathname.match(/^\/screens\/(home|identity|authority|review|workspace|verify)\.html$/);if(screen)return send(res,200,await readFile(`app/customer/public/screens/${screen[1]}.html`),'text/html; charset=utf-8');
 if(u.pathname==='/format.mjs')return send(res,200,await readFile('app/customer/format.mjs'),'text/javascript');
 if(['/ledger-deployment.html','/ledger-deployment.mjs','/ledger-deployment.css'].includes(u.pathname))return send(res,200,await readFile('app/customer/public'+u.pathname),u.pathname.endsWith('.html')?'text/html; charset=utf-8':u.pathname.endsWith('.css')?'text/css':'text/javascript');
 if(u.pathname==='/invoice-ui.css')return send(res,200,await readFile('app/customer/public/invoice-ui.css'),'text/css');
 if(u.pathname==='/invoice-states.mjs')return send(res,200,await readFile('app/customer/public/invoice-states.mjs'),'text/javascript');
 if(u.pathname==='/site.mjs')return send(res,200,await readFile('app/customer/public/site.mjs'),'text/javascript');
 const localFont=u.pathname.match(/^\/fonts\/((?:font-[0-4]|header-[0-2])\.ttf)$/);if(localFont)return send(res,200,await readFile('app/customer/public/fonts/'+localFont[1]),'font/ttf');
 if(['/stitch.css','/fonts.css','/header-fonts.css'].includes(u.pathname))return send(res,200,await readFile('app/customer/public'+u.pathname),'text/css');
 if(u.pathname==='/docs/invoices')return send(res,200,await readFile('docs/INVOICE-APPLICATION.md'),'text/plain; charset=utf-8');
 if(['/setup','/setup/authority','/setup/review','/workspace','/invoices'].includes(u.pathname))return send(res,200,await readFile('app/customer/public/index.html'),'text/html; charset=utf-8');
 const doc=u.pathname.match(/^\/api\/document\/([a-f0-9-]{36})\.(pdf|json)$/);if(doc){const d=await access.record(s,doc[1]),guard=access.guard(s);if(doc[2]==='pdf'){if(u.searchParams.has('download'))res.setHeader('Content-Disposition',`attachment; filename="${d.id}.pdf"`);const bytes=await service.pdf(d.id);guard();return send(res,200,bytes,'application/pdf');}return send(res,200,{kind:'HIR-ENS-invoice-evidence',chainId:platform.chainId,ledger:platform.ledger,name:d.name,bundle:d.bundle,expectedSupplierMustBeChosenIndependently:true});}
 const record=u.pathname.match(/^\/api\/draft\/([a-f0-9-]{36})$/);if(record)return send(res,200,await access.record(s,record[1]));
 const files={'/':['app/customer/public/index.html','text/html; charset=utf-8'],'/verify':['app/customer/public/index.html','text/html; charset=utf-8'],'/wallet.mjs':['app/customer/public/wallet.mjs','text/javascript'],'/presentation.mjs':['app/customer/public/presentation.mjs','text/javascript']};if(files[u.pathname])return send(res,200,await readFile(files[u.pathname][0]),files[u.pathname][1]);const font=u.pathname.match(/^\/fonts\/inter-(400|500|600)\.woff2$/);if(font)return send(res,200,await readFile(`node_modules/@fontsource/inter/files/inter-latin-${font[1]}-normal.woff2`),'font/woff2');return send(res,404,{error:'Not found'});
 }catch(e){return send(res,e.status||400,{error:e.shortMessage||e.message});}};
}
