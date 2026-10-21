const {_electron,chromium}=require('C:/Users/Пользователь/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
exports.launch=async options=>{
 const base=process.env.UI_STAGE_BASE||'http://localhost:3001';
 const env={...process.env,VITE_DEV_SERVER_URL:base,ZVONOK_DESKTOP_WEB_ORIGIN:base};delete env.ELECTRON_RUN_AS_NODE;
 const app=await _electron.launch({executablePath:path.resolve('artifacts/stages/release/win-unpacked.tmp/electron.exe'),
  args:[path.resolve('.'),'--user-data-dir='+fs.mkdtempSync(path.join(os.tmpdir(),'zvonok-stage5a-electron-')),
   '--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream'],env,timeout:30000});
 await app.firstWindow();
 const end=Date.now()+20000;let page;
 while(!page&&Date.now()<end){page=app.windows().find(p=>p.url().startsWith(base));if(!page)await new Promise(r=>setTimeout(r,100));}
 if(!page){await app.close();throw Error('No native application window');}
 const versions=await app.evaluate(({app})=>({electron:process.versions.electron,chrome:process.versions.chrome,packaged:app.isPackaged}));
 fs.writeFileSync('artifacts/stages/media-stage5a-evidence/electron-runtime.json',JSON.stringify(versions,null,2));
 const peers=await chromium.launch(options);let first=true;
 return {async newContext(options){if(!first)return peers.newContext(options);first=false;await page.setViewportSize(options.viewport||{width:1366,height:900});
  const native=page.context();return new Proxy(native,{get(target,key){if(key==='newPage')return async()=>page;if(key==='close')return async()=>{};const v=Reflect.get(target,key);return typeof v==='function'?v.bind(target):v;}});
 },async newPage(){return page;},async close(){await peers.close();await app.close();}};
};
if(require.main===module){
 const Module=require('node:module'),file=path.resolve('scripts/media-stage5a-spike.cjs');
 let source=fs.readFileSync(file,'utf8').replace("chromium.launch({channel:'chrome',headless:true})","require('./media-stage5a-electron.cjs').launch({channel:'chrome',headless:true})");
 source=source.replaceAll('spike.json','electron-spike.json').replaceAll('spike.png','electron-spike.png').replaceAll('spike-failure.png','electron-spike-failure.png');
 const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(source,file);
}
