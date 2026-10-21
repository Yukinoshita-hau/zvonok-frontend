const {_electron,chromium}=require('C:/Users/Пользователь/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
exports.launch=async options=>{
 const base=process.env.UI_STAGE_BASE||'http://localhost:3001';
 const packaged=process.argv.includes('--packaged');
 const env={...process.env,VITE_DEV_SERVER_URL:base,ZVONOK_DESKTOP_WEB_ORIGIN:base};delete env.ELECTRON_RUN_AS_NODE;
 const app=await _electron.launch({executablePath:path.resolve(packaged?'artifacts/stages/artifacts/stages/release-stage5b-final2/win-unpacked/Zvonok.exe':'artifacts/stages/release/win-unpacked.tmp/electron.exe'),
  args:[...(packaged?[]:[path.resolve('.')]),'--user-data-dir='+fs.mkdtempSync(path.join(os.tmpdir(),'zvonok-stage5b-electron-')),
   '--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream'],env,timeout:30000});
 const page=await app.firstWindow();
 if(packaged)await page.waitForURL('file://**',{waitUntil:'domcontentloaded',timeout:60000});
 else await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000});
 const versions=await app.evaluate(({app})=>({electron:process.versions.electron,chrome:process.versions.chrome,packaged:app.isPackaged}));
 fs.writeFileSync('artifacts/stages/media-stage5b-evidence/'+(packaged?'packaged-runtime':'electron-runtime')+'.json',JSON.stringify(versions,null,2));
 const downloads=fs.mkdtempSync(path.join(os.tmpdir(),'zvonok-stage5b-downloads-'));
 await app.evaluate(({session},folder)=>{globalThis.__stage5bDownloads=[];session.defaultSession.on('will-download',(_event,item)=>{const filename=item.getFilename(),target=folder+'/'+Date.now()+'-'+filename.replace(/[^a-zA-Z0-9._-]/g,'_');item.setSavePath(target);item.once('done',(_event,state)=>globalThis.__stage5bDownloads.push({filename,target,state}));});},downloads);
 const peers=await chromium.launch(options);let first=true;
 return {async newContext(options){if(!first)return peers.newContext(options);first=false;await page.setViewportSize(options.viewport||{width:1366,height:900});
  const native=page.context();return new Proxy(native,{get(target,key){if(key==='newPage')return async()=>page;if(key==='close')return async()=>{};const v=Reflect.get(target,key);return typeof v==='function'?v.bind(target):v;}});
 },async download(action){const before=await app.evaluate(()=>globalThis.__stage5bDownloads.length);await action();const deadline=Date.now()+30000;while(Date.now()<deadline){const item=await app.evaluate((_electron,index)=>globalThis.__stage5bDownloads[index],before);if(item){if(item.state!=='completed')throw Error('Native download '+item.state);return {suggestedFilename:()=>item.filename,path:async()=>item.target};}await new Promise(resolve=>setTimeout(resolve,100));}throw Error('Native download timeout: '+JSON.stringify(await app.evaluate(()=>globalThis.__stage5bDownloads)));},async newPage(){return page;},async close(){await peers.close();await app.close();}};
};





