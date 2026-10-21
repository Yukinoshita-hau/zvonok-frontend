// Reuse the Stage 4 acceptance with its first participant in the native app.
const {_electron,chromium}=require('C:/Users/Пользователь/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
exports.launch=async options=>{
 const env={...process.env,VITE_DEV_SERVER_URL:'http://localhost:3000',ZVONOK_DESKTOP_WEB_ORIGIN:'http://localhost:3000'};delete env.ELECTRON_RUN_AS_NODE;
 const app=await _electron.launch({executablePath:path.resolve('artifacts/stages/release/win-unpacked.tmp/electron.exe'),args:[path.resolve('.'),'--user-data-dir='+fs.mkdtempSync(path.join(os.tmpdir(),'zvonok-core-electron-')),'--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required'],env,timeout:30000});
 await app.firstWindow();
 const page=await new Promise((resolve,reject)=>{const end=Date.now()+20000;const timer=setInterval(()=>{const p=app.windows().find(p=>p.url().startsWith('http://localhost:3000'));if(p){clearInterval(timer);resolve(p);}else if(Date.now()>end){clearInterval(timer);reject(Error('No application window: '+app.windows().map(p=>p.url()).join(', ')));}},100);});
 await page.waitForFunction(()=>innerWidth>0&&innerHeight>0);
 await page.goto('http://localhost:3000/auth/register');
 await page.locator('[name=username]').waitFor();
 await page.screenshot({path:'artifacts/stages/core-final-evidence/electron-main.png'});
 const native=page.context(), peers=await chromium.launch(options);let first=true;
 const versions=await app.evaluate(()=>({electron:process.versions.electron,arch:process.arch}));
 fs.writeFileSync('artifacts/stages/core-final-evidence/electron-launch.json',JSON.stringify({status:'PASS',versions,gpuDisabled:false,syntheticDevices:true},null,2));
 return {
  async newContext(options){if(!first)return peers.newContext(options);first=false;
   await page.setViewportSize(options.viewport);
   return new Proxy(native,{get(target,key){if(key==='newPage')return async()=>page;if(key==='close')return async()=>{};const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;}});
  },
  async close(){await peers.close();await app.close();fs.writeFileSync('artifacts/stages/core-final-evidence/electron-closed.json',JSON.stringify({closed:true}));}
 };
};
if(require.main===module){
 const Module=require('node:module'),file=path.resolve('scripts/ui-call-stage-acceptance.cjs');
 const source=fs.readFileSync(file,'utf8').replace('const browser = await chromium.launch({','const browser = await require("./core-electron-browser.cjs").launch({');
 if(!source.includes('const browser = await require('))throw Error('acceptance launcher not found');
 process.env.UI_STAGE_BASE='http://localhost:3000';process.env.UI_STAGE_API='http://localhost:8080/api';process.env.UI_STAGE_EVIDENCE='artifacts/stages/core-final-evidence/electron-settings';
 process.argv.push('--settings');const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(source,file);
}
