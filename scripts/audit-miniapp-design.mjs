import {mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createPreviewServer} from '../docs/preview/server.mjs';
import {root} from '../docs/preview/build.mjs';
import {brand} from '../miniapp/src/brand.js';
process.env.PLAYWRIGHT_BROWSERS_PATH??=path.join(root,'runtime/tools/playwright');
const {chromium}=await import('playwright');
const output=path.join(root,'runtime/ui-fidelity'),media=path.join(root,'docs/media/design-review');
await mkdir(output,{recursive:true});await mkdir(media,{recursive:true});
const server=await createPreviewServer();let browser;const cases=[],failures=[],screenshots=[],regressions=[];
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
async function ready(page,id){await page.waitForFunction(id=>window.__preview?.current?.data.page===id&&!window.__preview.current.data.loading,id);const error=await page.evaluate(()=>window.__preview.current.data.error);if(error)throw new Error(id+': '+error);}
async function seed(page,id,scenario='registration'){const stage=['MP01','MP02'].includes(id)?(scenario==='quotation'?'analysis':'ready'):['MP03','MP06','MP07'].includes(id)?'analysis':id==='MP04'?'quoted':'delivered';await page.evaluate(({id,stage,scenario})=>window.__preview.seed(id,stage,scenario),{id,stage,scenario});await ready(page,id);}
async function measure(page){return page.evaluate(()=>{
 const app=document.getElementById('app'),bounds=app.getBoundingClientRect(),visible=el=>el.getClientRects().length>0&&getComputedStyle(el).visibility!=='hidden';
 const controls=[...app.querySelectorAll('button,input,textarea')].filter(visible),small=controls.filter(el=>{const r=el.getBoundingClientRect();return r.width<47.5||r.height<47.5;}).map(el=>({label:el.textContent.trim().slice(0,48)||el.getAttribute('aria-label')||el.dataset.field,width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height}));
 const overflows=[...app.querySelectorAll('view,button,input,textarea,img,text')].filter(el=>visible(el)&&!el.closest('.horizontal')&&getComputedStyle(el).position!=='fixed').filter(el=>{const r=el.getBoundingClientRect();return r.width&& (r.left<bounds.left-1||r.right>bounds.right+1);}).map(el=>({tag:el.tagName,css:el.className,text:el.textContent.trim().slice(0,48)})).slice(0,10);
 const nav=app.querySelector('.bottom')?.getBoundingClientRect(),action=app.querySelector('.action-bar.fixed,.action-bar.fixed-home,.home-footer .action-bar')?.getBoundingClientRect();
 const overlap=!!(nav&&action&&action.bottom>nav.top+1);
 const images=[...app.querySelectorAll('img')].filter(el=>!el.complete||!el.naturalWidth).map(el=>el.getAttribute('src'));
 const pageEl=app.querySelector('.page');
 const fixedTop=Math.min(nav?.top??bounds.bottom,action?.top??bounds.bottom),goal=app.querySelector('input[data-field="goal"]')?.getBoundingClientRect();
 const goalObscured=!!(goal&&bounds.width>=375&&goal.bottom>fixedTop+1&&goal.top<bounds.bottom);
 const initialTop=app.scrollTop;app.scrollTop=app.scrollHeight;const last=[...app.querySelectorAll('.page button,.page input,.page textarea')].filter(el=>visible(el)&&!el.closest('.action-bar.fixed,.action-bar.fixed-home,.home-footer')).at(-1)?.getBoundingClientRect();const lastObscured=!!(last&&last.bottom>fixedTop+1);app.scrollTop=initialTop;
 return {width:bounds.width,document_overflow:app.scrollWidth>app.clientWidth+1,small_targets:small,element_overflows:overflows,toolbar_overlap:overlap,initial_goal_obscured:goalObscured,last_control_obscured:lastObscured,missing_icons:images,gutter:parseFloat(getComputedStyle(pageEl).paddingLeft),folder_count:app.querySelectorAll('.folder').length,controls:controls.length};
 });}
function record(meta,result){const failed=result.document_overflow||result.small_targets.length||result.element_overflows.length||result.toolbar_overlap||result.last_control_obscured||(meta.variant==='quotation'&&result.initial_goal_obscured)||result.missing_icons.length||result.gutter!==16||result.folder_count>1;cases.push({...meta,...result,passed:!failed});if(failed)failures.push({...meta,...result});}
try{browser=await chromium.launch({headless:true});
 for(const provider of ['ALIPAY','DOUYIN']){
  const context=await browser.newContext({viewport:{width:375,height:920},locale:'zh-CN',reducedMotion:'reduce'});
  try{const page=await context.newPage();page.on('pageerror',error=>failures.push({provider,page_error:error.message}));page.on('dialog',d=>d.accept());await page.goto(server.url+'/?provider='+provider);await ready(page,'MP01');
   const branding=await page.evaluate(()=>({title:document.getElementById('page-title').textContent,name:document.querySelector('.home-brand .hero')?.textContent,logo:document.querySelector('.brand-logo')?.getAttribute('src')}));
   if(branding.title!==brand.name||branding.name!==brand.name||branding.logo!==brand.logo)failures.push({provider,brand_mismatch:branding});
   for(const width of [320,375,390,430]){await page.setViewportSize({width,height:920});for(let n=1;n<=18;n++){
    const id='MP'+String(n).padStart(2,'0');await seed(page,id);await page.evaluate(()=>Promise.all([...document.images].map(img=>img.decode().catch(()=>{}))));record({provider,page:id,viewport:{width,height:920},variant:'standard'},await measure(page));
   }}
   for(const id of ['MP01','MP06','MP10']){await page.setViewportSize({width:375,height:920});await seed(page,id,'quotation');await page.evaluate(()=>Promise.all([...document.images].map(img=>img.decode().catch(()=>{}))));
    const filename=`${provider.toLowerCase()}-${id}.png`;await page.screenshot({path:path.join(media,filename),animations:'disabled'});screenshots.push({path:'docs/media/design-review/'+filename,sha256:digest(await readFile(path.join(media,filename))),scenario:'SYNTHETIC_QUOTATION',provider,page:id});
    if(provider==='ALIPAY'){await page.screenshot({path:path.join(output,id+'-after.png'),animations:'disabled'});}
    record({provider,page:id,viewport:{width:375,height:920},variant:'quotation'},await measure(page));
    await page.evaluate(()=>{const nodes=[...document.querySelectorAll('#app view,#app text,#app button,#app input,#app textarea')],sizes=nodes.map(el=>{const c=getComputedStyle(el);return {font:parseFloat(c.fontSize),line:parseFloat(c.lineHeight)};});nodes.forEach((el,i)=>{el.style.fontSize=sizes[i].font*1.35+'px';el.style.lineHeight=(sizes[i].line||sizes[i].font*1.5)*1.35+'px';});});
    record({provider,page:id,viewport:{width:375,height:920},variant:'text-135-percent-simulation'},await measure(page));
   }
   await page.setViewportSize({width:812,height:430});await seed(page,'MP06','quotation');record({provider,page:'MP06',viewport:{width:812,height:430},variant:'landscape'},await measure(page));
   await page.setViewportSize({width:320,height:700});await seed(page,'MP01','quotation');await page.evaluate(()=>{const c=window.__preview.current;c.setData({homeSources:c.data.homeSources.map(s=>({...s,name:'供应商文件名称很长而且没有空格'.repeat(3)+'.pdf'}))});});record({provider,page:'MP01',viewport:{width:320,height:700},variant:'long-filenames'},await measure(page));
   await seed(page,'MP06','quotation');await page.evaluate(()=>{const c=window.__preview.current;c.setData({fieldCards:c.data.fieldCards.map(f=>({...f,label:'需要完整阅读的很长字段名称',reason:'原资料中的含义应保留，并可以继续进入字段编辑'}))});});record({provider,page:'MP06',viewport:{width:320,height:700},variant:'long-field-labels'},await measure(page));
   await seed(page,'MP02');await page.evaluate(()=>window.__preview.current.setData({error:'网络暂时不可用，请重试。输入的文字继续保留。',text:'尚未提交的合成内容'}));record({provider,page:'MP02',viewport:{width:320,height:700},variant:'network-error'},await measure(page));
   // Real controller events: goals and selected mode survive page navigation, never persisted as content.
   await page.setViewportSize({width:375,height:640});await page.evaluate(()=>window.__preview.seed('MP01','ready'));await ready(page,'MP01');
   await page.locator('input[data-field="goal"]').fill('保留这个用途，一条记录一行');await page.locator('.mode').filter({hasText:'我有规范'}).click();
   await page.locator('[data-action="go-MP02"]').first().click();await ready(page,'MP02');await page.locator('textarea[data-field="text"]').fill('合成资料：甲，19.90 元');await page.locator('[data-action="add-text"]').click();await ready(page,'MP02');
   const saved=await page.evaluate(()=>({goal:window.__preview.state.task.goal,mode:window.__preview.state.task.mode}));const passed=saved.goal==='保留这个用途，一条记录一行'&&saved.mode==='PROVIDED';regressions.push({provider,test:'draft-goal-and-mode-survive-navigation',passed,...saved});if(!passed)failures.push(regressions.at(-1));
   await seed(page,'MP10','quotation');const initial=await page.evaluate(()=>({choice:window.__preview.current.data.selectedAction,disabled:document.querySelector('[data-action="decision-preview"]').disabled}));
   const safe=initial.choice===''&&initial.disabled;regressions.push({provider,test:'issue-decision-requires-explicit-choice',passed:safe});if(!safe)failures.push(regressions.at(-1));
   await page.locator('[data-action="KEEP_UNRESOLVED"]').click();await page.locator('[data-action="evidence"]').first().click();await ready(page,'MP11');await page.locator('#back').click();await ready(page,'MP10');const retained=await page.evaluate(()=>window.__preview.current.data.selectedAction==='KEEP_UNRESOLVED');regressions.push({provider,test:'evidence-return-keeps-explicit-decision',passed:retained});if(!retained)failures.push(regressions.at(-1));
   await seed(page,'MP06','quotation');await page.locator('[data-action="go-MP07"]').first().click();await ready(page,'MP07');
   await page.locator('input[data-property="label"]').first().fill('修改后仍保留的字段');await page.locator('.field-trigger').nth(1).click();await page.locator('.field-trigger').first().click();const draftKept=await page.locator('input[data-property="label"]').first().inputValue()==='修改后仍保留的字段';regressions.push({provider,test:'field-collapse-retains-unsaved-draft',passed:draftKept});if(!draftKept)failures.push(regressions.at(-1));
   await seed(page,'MP12','quotation');const beforeCount=await page.locator('[data-action="download"]').count();await page.locator('[data-action="toggle-files"]').click();const afterCount=await page.locator('[data-action="download"]').count();const allFiles=beforeCount===3&&afterCount===9;regressions.push({provider,test:'all-nine-artifacts-remain-reachable',passed:allFiles});if(!allFiles)failures.push(regressions.at(-1));
   await seed(page,'MP08','quotation');const collapsed=await page.locator('.record').first().locator('.field-row').count();await page.locator('[data-action="toggle-record"]').first().click();const expanded=await page.locator('.record').first().locator('.field-row').count();const allFields=collapsed===5&&expanded===9;regressions.push({provider,test:'record-preview-expands-to-all-fields',passed:allFields});if(!allFields)failures.push(regressions.at(-1));
   await page.setViewportSize({width:375,height:540});await seed(page,'MP01');const input=page.locator('input[data-field="goal"]');await input.focus();await input.evaluate(el=>el.scrollIntoView({block:'center'}));const accessible=await input.evaluate(el=>{const r=el.getBoundingClientRect(),footer=document.querySelector('.home-footer').getBoundingClientRect();return r.top>=100&&r.bottom<=footer.top;});regressions.push({provider,test:'focused-goal-reachable-in-short-viewport',passed:accessible});if(!accessible)failures.push(regressions.at(-1));
   await page.evaluate(()=>window.__preview.dispose());
  }finally{await context.close();}
 }
}catch(error){failures.push({exception:error.message});}finally{await browser?.close();await server.close();}
const sourceFiles=['miniapp/src/theme.css','miniapp/src/components.js','miniapp/src/controller.js','miniapp/src/presentation.js','miniapp/src/navigation.js','miniapp/src/brand.js','miniapp/src/assets/brand/logo.png','assets/brand/current.json',...Array.from({length:18},(_,i)=>'miniapp/src/pages/MP'+String(i+1).padStart(2,'0')+'.xml')];
const sources=[];for(const file of sourceFiles)sources.push({path:file,sha256:digest(await readFile(path.join(root,file)))});
const report={protocol:'P07-DESIGN-FIDELITY-1',captured_at:new Date().toISOString(),reference:'P07-DS-B1.0.0',brand_release_id:brand.releaseId,brand_name:brand.name,cases,regressions,failures,screenshots,sources,browser_closed:true,scope:'Actual native source with the user-approved brand overlay in documentation browser adapters; synthetic data; text scaling is simulated. Native devices, keyboard, dark mode and Ubuntu are NOT_RUN.'};
await writeFile(path.join(output,'audit.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({cases:cases.length,regressions:regressions.length,failures:failures.length,browser_closed:true,report:'runtime/ui-fidelity/audit.json'}));if(failures.length){console.log(JSON.stringify(failures.slice(0,8),null,2));process.exitCode=1;}
