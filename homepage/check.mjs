import assert from 'node:assert/strict';import {readFile,mkdir} from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';import {chromium} from 'playwright';
const directory=fileURLToPath(new URL('.',import.meta.url)),root=path.dirname(directory),origin='https://hir-homepage.test',output=path.join(root,'.local/homepage-check');await mkdir(output,{recursive:true});
const config=JSON.parse(await readFile(path.join(directory,'wrangler.jsonc'),'utf8'));
assert.equal(config.name,'hir');assert.equal(config.main,undefined);assert.equal(config.durable_objects,undefined);assert.equal(config.preview_urls,false);
// The legacy test-options adapter requires a script; the asset router must never invoke it.
const mf=new Miniflare(convertV4MiniflareOptions({name:'hir-homepage-check',modules:true,script:'export default {fetch(){return new Response("Unexpected user worker",{status:500})}}',compatibilityDate:config.compatibility_date,assets:{directory:path.join(directory,config.assets.directory),routerConfig:{has_user_worker:false},assetConfig:{html_handling:config.assets.html_handling,not_found_handling:config.assets.not_found_handling}}}));
let browser;const errors=[],requests=[];let assertions=0;const check=(value,message)=>{assert.ok(value,message);assertions++;};
try{
 const home=await mf.dispatchFetch(origin+'/'),html=await home.text();check(home.status===200,'Homepage is served by workerd');check(home.headers.get('content-security-policy')?.includes("default-src 'none'"),'CSP is applied by static assets');check(!home.headers.has('set-cookie'),'Homepage sets no authentication cookies');check((await mf.dispatchFetch(origin+'/missing')).status===404,'Unknown routes remain 404');check(!/<script\b/.test(html),'Homepage needs no runtime JavaScript');
 const original=await readFile(path.join(root,'app/customer/public/index.html'),'utf8'),footer=original.match(/<footer[\s\S]*?<\/footer>/)[0],actual=html.match(/<footer[\s\S]*?<\/footer>/)[0];
 const expected=footer.replace('href="/#how-it-works"','href="#how-it-works"').replace('href="/verify"','href="https://hir-invoice.neetlav.workers.dev/verify"').replace('href="/#for-organizations"','href="https://hir-invoice.neetlav.workers.dev/#for-organizations"').replace('href="/docs/invoices"','href="https://hir-invoice.neetlav.workers.dev/docs/invoices"');
 assert.equal(actual,expected);assertions++;
 browser=await chromium.launch({headless:true,chromiumSandbox:true,...(process.env.HIR_BROWSER_CHANNEL?{channel:process.env.HIR_BROWSER_CHANNEL}:{})});
 const context=await browser.newContext();await context.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());requests.push(url.href);
  if(url.origin!==origin){errors.push('Unexpected external request: '+url.origin);await route.abort();return;}
  if(url.pathname==='/reference-footer'){await route.fulfill({status:200,contentType:'text/html',body:`<!doctype html><html lang="en"><head><link rel="stylesheet" href="/fonts.css"><link rel="stylesheet" href="/reference.css"></head><body class="bg-background text-body-text antialiased">${footer}</body></html>`});return;}
  if(url.pathname==='/reference.css'){await route.fulfill({status:200,contentType:'text/css',body:await readFile(path.join(root,'app/customer/public/stitch.css'))});return;}
  const result=await mf.dispatchFetch(url.href,{method:request.method()});if(result.status>=400)errors.push('Asset '+result.status+': '+url.pathname);await route.fulfill({status:result.status,headers:Object.fromEntries(result.headers),body:Buffer.from(await result.arrayBuffer())});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 for(const width of [1280,1440,1920,390]){
  await page.setViewportSize({width,height:1000});await page.goto(origin+'/');await page.evaluate(()=>document.fonts.ready);
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal page overflow at '+width);
  check(await page.locator('h1').count()===1,'One page heading at '+width);
  check((await page.locator('h1').innerText()).replace(/\s+/g,' ').trim()==='Know what was authorized. Verify what happened.','Approved hero wording at '+width);
  check(await page.locator('main').evaluate(el=>getComputedStyle(el).fontFamily.includes('Plus Jakarta Sans')),'Local homepage typography at '+width);
  check(await page.locator('main .material-symbols-outlined').first().evaluate(el=>getComputedStyle(el).fontFamily.includes('Material Symbols')),'Local Material Symbols at '+width);
  const cards=page.locator('#applications > div > div.grid > div'),boxes=await cards.evaluateAll(nodes=>nodes.map(el=>{const r=el.getBoundingClientRect();return{width:r.width,height:r.height,top:r.top};}));
  check(boxes.length===2&&Math.abs(boxes[0].width-boxes[1].width)<1,'Equal application prominence at '+width);if(width>=768)check(boxes[0].top===boxes[1].top&&boxes[0].height===boxes[1].height,'Aligned desktop cards at '+width);
  check(await page.getByText('ENS policy assessment',{exact:true}).count()===1&&await page.getByText('Receiver decision',{exact:true}).count()===1&&await page.getByText('Evidence recorded',{exact:true}).count()===1,'Agent stages remain distinct at '+width);
  check(await page.getByText('Illustrative example',{exact:true}).count()===2,'Both illustrations labeled at '+width);
  for(const [label,url]of [['Explore Invoices','https://hir-invoice.neetlav.workers.dev/'],['Explore Agents','https://hir-agents.neetlav.workers.dev/']])for(const link of await page.getByRole('link',{name:label,exact:true}).all())check(await link.getAttribute('href')===url,'Real module destination: '+label);
  await page.screenshot({path:path.join(output,'homepage-'+width+'.png'),fullPage:true});
 }
 await page.setViewportSize({width:1440,height:1000});await page.goto(origin+'/');await page.evaluate(()=>document.fonts.ready);
 await page.keyboard.press('Tab');check(await page.getByRole('link',{name:'Skip to content'}).evaluate(el=>el===document.activeElement),'Keyboard skip link is first');await page.keyboard.press('Enter');check(new URL(page.url()).hash==='#main','Skip link targets main');
 await page.getByRole('link',{name:'Explore Use Cases'}).click();check(new URL(page.url()).hash==='#applications','Use cases anchor works');await page.locator('nav[aria-label="Main navigation"]').getByRole('link',{name:'How It Works'}).click();check(new URL(page.url()).hash==='#how-it-works','How It Works anchor works');
 const properties=['fontFamily','fontSize','fontWeight','lineHeight','color','backgroundColor','paddingTop','paddingBottom','paddingLeft','paddingRight','gap','marginTop','maxWidth','letterSpacing'];
 const footerStyles=async p=>p.locator('.site-footer, .footer-inner, .footer-main, .footer-description, .footer-wordmark, .footer-description p, .site-footer nav, .footer-bottom').evaluateAll((nodes,properties)=>nodes.map(el=>{const s=getComputedStyle(el);return Object.fromEntries(properties.map(k=>[k,s[k]]));}),properties);
 const reference=await context.newPage();await reference.setViewportSize({width:1440,height:1000});await reference.goto(origin+'/reference-footer');await reference.evaluate(()=>document.fonts.ready);assert.deepEqual(await footerStyles(page),await footerStyles(reference));assertions++;
 await page.setViewportSize({width:390,height:900});await page.goto(origin+'/');const menu=page.locator('.mobile-navigation summary');await menu.focus();await page.keyboard.press('Enter');check(await page.locator('.mobile-navigation').getAttribute('open')!==null,'Narrow navigation works by keyboard');check(await page.locator('.mobile-navigation nav').getByRole('link',{name:'Invoices',exact:true}).isVisible(),'Narrow module navigation remains accessible');
 check(!requests.some(url=>new URL(url).pathname.startsWith('/api/')),'No API or authentication requests');assert.deepEqual(errors,[]);assertions++;
 console.log(JSON.stringify({status:'passed',assertions,viewports:[1280,1440,1920,390],footer:'exact markup except link destinations; matching computed desktop styles',externalRequests:0,walletRequests:0,chromiumSandbox:true,screenshots:'.local/homepage-check/'}));
}finally{await browser?.close();await mf.dispose();}
