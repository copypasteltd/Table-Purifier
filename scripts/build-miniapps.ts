import { mkdir,readFile,writeFile,readdir } from 'node:fs/promises';
import { join,relative } from 'node:path';
import { build } from 'esbuild';
import { PROJECT_ROOT } from '../src/shared/config.js';
import { sha256 } from '../src/shared/crypto.js';
import {navigationMarkup,rootPages,headerTitle} from '../miniapp/src/navigation.js';

const root=join(PROJECT_ROOT,'miniapp'),source=join(root,'src');
const spec=JSON.parse(await readFile(join(PROJECT_ROOT,'assets/design/b-jade-folders/v1.0.0/specs/pages.json'),'utf8')) as {pages:{page_id:string;title:string}[]};
const componentModule=await import('../miniapp/src/components.js' as string) as {components:Record<string,{id:string;xml:string}>};
const components=componentModule.components;
let config:Record<string,unknown>;
try{config=JSON.parse(await readFile(join(root,'config.local.json'),'utf8'));}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;config=JSON.parse(await readFile(join(root,'config.example.json'),'utf8'));}
const skill=JSON.parse(await readFile(join(PROJECT_ROOT,'agent/skill/manifest.json'),'utf8'));
await writeFile(join(root,'config.generated.json'),JSON.stringify({...config,skillReleaseId:skill.release_id}));
await writeFile(join(source,'pages.generated.js'),'export const titles='+JSON.stringify(Object.fromEntries(spec.pages.map(p=>[p.page_id,p.title])))+';\n');
const css=await readFile(join(source,'theme.css'),'utf8');
const inputs:{path:string;sha256:string;bytes:number}[]=[];
async function collectInputs(directory:string):Promise<void>{for(const entry of (await readdir(directory,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const file=join(directory,entry.name);if(entry.isDirectory())await collectInputs(file);else{const bytes=await readFile(file);inputs.push({path:relative(PROJECT_ROOT,file).replaceAll('\\','/'),bytes:bytes.length,sha256:sha256(bytes)});}}}
await collectInputs(source);
for(const path of ['scripts/build-miniapps.ts','assets/design/b-jade-folders/v1.0.0/specs/pages.json','agent/skill/manifest.json']){const bytes=await readFile(join(PROJECT_ROOT,path));inputs.push({path,bytes:bytes.length,sha256:sha256(bytes)});}
for(const provider of ['ALIPAY','DOUYIN'] as const){
 const alipay=provider==='ALIPAY',folder=alipay?'mini-alipay':'mini-douyin',out=join(PROJECT_ROOT,'src',folder),ext=alipay?'axml':'ttml',style=alipay?'acss':'ttss';
 const outputs:{path:string;sha256:string;bytes:number}[]=[];
 const put=async(name:string,text:string)=>{const file=join(out,name);await mkdir(join(file,'..'),{recursive:true});await writeFile(file,text);outputs.push({path:name,bytes:Buffer.byteLength(text),sha256:sha256(text)});};
 const xml=(text:string)=>text.replaceAll('p:',alipay?'a:':'tt:').replaceAll('onTap=',alipay?'onTap=':'bindtap=').replaceAll('onInput=',alipay?'onInput=':'bindinput=').replaceAll('onAction=',alipay?'onAction=':'bind:action=');
 const componentRefs=Object.fromEntries(Object.keys(components).map(name=>[name,'/components/'+name+'/index']));
 const stringProps=['title','text','action','itemId','variant','icon','meta'],boolProps=['disabled','loading','selected'],props:Record<string,unknown>={};
 for(const p of stringProps)props[p]='';for(const p of boolProps)props[p]=false;props.count=0;
 for(const[name,c]of Object.entries(components)){
  const definition=alipay?`props:${JSON.stringify({...props,onAction:null})},methods:{act(){if(this.props.onAction)this.props.onAction({action:this.props.action,id:this.props.itemId})}}`:
   `properties:{${Object.entries(props).map(([k,v])=>k+':{type:'+(typeof v==='boolean'?'Boolean':typeof v==='number'?'Number':'String')+',value:'+JSON.stringify(v)+'}').join(',')}},methods:{act(){this.triggerEvent('action',{action:this.data.action,id:this.data.itemId})}}`;
  await put(`components/${name}/index.js`,'Component({'+definition+'});\n');
  await put(`components/${name}/index.json`,JSON.stringify({component:true}));
  await put(`components/${name}/index.${ext}`,xml(c.xml));await put(`components/${name}/index.${style}`,css);
 }
 for(const p of spec.pages){const body=await readFile(join(source,'pages',p.page_id+'.xml'),'utf8');
  const tabs=navigationMarkup(p.page_id),variant=rootPages.includes(p.page_id)?'page-root':'';
  await put(`pages/${p.page_id}/index.js`,`const {createPage}=require('../../common/controller.js');Page(createPage('${p.page_id}'));\n`);
  const header=headerTitle(p.page_id,p.title);
  await put(`pages/${p.page_id}/index.json`,JSON.stringify({...alipay?{defaultTitle:header}:{navigationBarTitleText:header},usingComponents:componentRefs}));
  await put(`pages/${p.page_id}/index.${ext}`,xml(`<b-frame variant="${variant}"><view p:if="{{loading}}" class="notice">正在处理，请稍候……</view><view p:if="{{error}}" class="error">{{error}}<button class="button" data-action="refresh" onTap="onAction">重新读取状态</button></view><b-message text="{{notice}}"/>${body}</b-frame>${tabs}`));
  await put(`pages/${p.page_id}/index.${style}`,css);
 }
 await mkdir(join(out,'common'),{recursive:true});
 const bundled=await build({entryPoints:[join(source,'controller.js')],bundle:true,write:false,platform:'neutral',format:'cjs',target:'es2017',define:{__P07_PROVIDER__:JSON.stringify(provider)},minify:false});
 await put('common/controller.js',bundled.outputFiles[0]!.text);
 await put('app.js','App({onLaunch(){},onHide(){}});\n');await put('app.'+style,css);
 await put('app.json',JSON.stringify({pages:spec.pages.map(p=>'pages/'+p.page_id+'/index'),window:alipay?{defaultTitle:'表格修复站',titleBarColor:'#EAF1EE',backgroundColor:'#EAF1EE'}:{navigationBarTitleText:'表格修复站',navigationBarBackgroundColor:'#EAF1EE',backgroundColor:'#EAF1EE'}},null,2));
 for(const name of await readdir(join(source,'assets/icons'))){const bytes=await readFile(join(source,'assets/icons',name));await mkdir(join(out,'assets/icons'),{recursive:true});await writeFile(join(out,'assets/icons',name),bytes);outputs.push({path:'assets/icons/'+name,bytes:bytes.length,sha256:sha256(bytes)});}
 const appConfig=config[provider] as {appId:string};await put(alipay?'mini.project.json':'project.config.json',JSON.stringify({appid:appConfig.appId,projectname:'表格修复站',...(alipay?{enableAppxNg:true}:{setting:{es6:true,minified:false,urlCheck:true}})},null,2));
 await put('source-manifest.json',JSON.stringify({provider,build_id:config.buildId,design:'P07-DS-B1.0.0',skill_release_id:skill.release_id,pages:18,components:32,native_device_status:'NOT_RUN',source_inputs:inputs,files:outputs},null,2));
 process.stdout.write(JSON.stringify({provider,directory:relative(PROJECT_ROOT,out),pages:18,components:Object.keys(components).length,bytes:outputs.reduce((s,f)=>s+f.bytes,0),status:'SOURCE_BUILT_NOT_DEVICE_VERIFIED'})+'\n');
}
