// Read the immutable pre-repair commit without changing the working tree.
// Use the same current synthetic quotation fixture, so data does not explain the visual difference.
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile,cp} from 'node:fs/promises';
import path from 'node:path';
import {build} from 'esbuild';
import {root} from '../docs/preview/build.mjs';
import {createPreviewServer} from '../docs/preview/server.mjs';
const baseline='a9d9699b2613654d8778e836f61ecf62056fbc09';
const old=file=>execFileSync('git',['show',baseline+':'+file],{cwd:root,encoding:'utf8',maxBuffer:8_000_000});
const out=path.join(root,'runtime/ui-fidelity/before-preview');await mkdir(out,{recursive:true});
const templates={};for(let n=1;n<=18;n++){const id='MP'+String(n).padStart(2,'0');templates[id]=old('miniapp/src/pages/'+id+'.xml');}
await build({entryPoints:[path.join(root,'docs/preview/main.js')],bundle:true,outfile:path.join(out,'ALIPAY.js'),format:'iife',platform:'browser',target:'es2022',define:{__P07_PROVIDER__:JSON.stringify('ALIPAY'),__TEMPLATES__:JSON.stringify(templates)},plugins:[{name:'immutable-before-source',setup(builder){
 builder.onLoad({filter:/[\\/]miniapp[\\/]src[\\/](controller|components)\.js$/},args=>({contents:old(path.relative(root,args.path).replaceAll('\\','/')),loader:'js'}));
 builder.onLoad({filter:/[\\/]docs[\\/]preview[\\/]main\.js$/},()=>({contents:old('docs/preview/main.js').replace("async seed(id, stage = 'delivered')", "async seed(id, stage = 'delivered',scenario='registration')").replace('reset(stage);','reset(stage,scenario);'),loader:'js'}));
 builder.onResolve({filter:/^\.\/(client|platform)\.js$/},args=>args.importer.replaceAll('\\','/').endsWith('/miniapp/src/controller.js')?{path:path.join(root,'docs/preview',args.path.slice(2))}:undefined);
 }}]});
await writeFile(path.join(out,'native.css'),old('miniapp/src/theme.css'));for(const file of ['index.html','preview.css'])await writeFile(path.join(out,file),old('docs/preview/'+file));
await cp(path.join(root,'miniapp/src/assets'),path.join(out,'assets'),{recursive:true});
process.env.PLAYWRIGHT_BROWSERS_PATH??=path.join(root,'runtime/tools/playwright');const {chromium}=await import('playwright');
const server=await createPreviewServer(0,out);let browser;const screenshots=[];
try{browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:375,height:920},locale:'zh-CN',reducedMotion:'reduce'});try{const page=await context.newPage();for(const id of ['MP01','MP06','MP10']){
 await page.goto(server.url);await page.waitForFunction(()=>window.__preview?.current&&!window.__preview.current.data.loading);
 await page.evaluate(id=>window.__preview.seed(id,id==='MP10'?'delivered':'analysis','quotation'),id);await page.waitForFunction(id=>window.__preview.current.data.page===id&&!window.__preview.current.data.loading,id);
 const error=await page.evaluate(()=>window.__preview.current.data.error);if(error)throw new Error(error);
 const file='docs/media/design-review/before-'+id+'.png';await page.screenshot({path:path.join(root,file),animations:'disabled'});screenshots.push({page:id,path:file});
 }}finally{await context.close();}}finally{await browser?.close();await server.close();}
await writeFile(path.join(root,'runtime/ui-fidelity/before-receipt.json'),JSON.stringify({baseline,scope:'Historical templates/components/controller/theme, current documentation-only quotation fixture; not native-device evidence.',screenshots,browser_closed:true},null,2)+'\n');
console.log(JSON.stringify({baseline,screenshots:screenshots.length,browser_closed:true}));
