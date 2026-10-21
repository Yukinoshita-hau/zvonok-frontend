const fs=require('node:fs'), path=require('node:path');
const root=path.resolve('artifacts/stages/release/win-unpacked.tmp'), out=process.env.CORE_ELECTRON_OUT || 'artifacts/stages/core-final-evidence';
fs.mkdirSync(out,{recursive:true});
function pe(file){
 const b=fs.readFileSync(file), h=b.readUInt32LE(60), sections=b.readUInt16LE(h+6), opt=h+24, plus=b.readUInt16LE(opt)===0x20b;
 const table=opt+b.readUInt16LE(h+20), rva=x=>{for(let i=0;i<sections;i++){const s=table+i*40,va=b.readUInt32LE(s+12);if(x>=va&&x<va+Math.max(b.readUInt32LE(s+8),b.readUInt32LE(s+16)))return x-va+b.readUInt32LE(s+20);}return x;};
 const str=x=>b.toString('ascii',x,b.indexOf(0,x)), imports=[];
 const imp=b.readUInt32LE(opt+(plus?112:96)+8);
 if(imp)for(let i=rva(imp);b.readUInt32LE(i+12);i+=20)imports.push(str(rva(b.readUInt32LE(i+12))));
 return {machine:b.readUInt16LE(h+4).toString(16),imports};
}
const files=fs.readdirSync(root).filter(f=>/\.(dll|exe)$/i.test(f)), inventory=files.map(f=>({file:f,...pe(path.join(root,f))}));
const missing=[];
const seen=new Set();
function walk(file,chain=[]){
 if(seen.has(file.toLowerCase()))return; seen.add(file.toLowerCase());
 let p;try{p=pe(file);}catch{return;}
 for(const dll of p.imports){if(/^(api|ext)-ms-/i.test(dll))continue;
  const resolved=[path.join(root,dll),path.join(process.env.SystemRoot,'System32',dll)].find(f=>fs.existsSync(f));
  if(resolved)walk(resolved,[...chain,path.basename(file)]);else missing.push({dll,chain:[...chain,path.basename(file)]});
 }
}
for(const f of files)walk(path.join(root,f));
fs.writeFileSync(out+'/electron-dependencies.json',JSON.stringify({inventory,missing},null,2));console.log('Missing imports',missing);
const { _electron }=require('C:/Users/Пользователь/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const os=require('node:os'), dir=fs.mkdtempSync(path.join(os.tmpdir(),'zvonok-clean-electron-'));
 fs.writeFileSync(path.join(dir,'main.cjs'),"const {app,BrowserWindow}=require('electron');app.whenReady().then(()=>{const w=new BrowserWindow({webPreferences:{sandbox:true}});w.loadURL('data:text/html,<h1>Clean Electron runtime</h1>');});");
 const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
 const results=[];
 for(const [name,args] of [['clean',[path.join(dir,'main.cjs')]]]){
  let app;try{app=await _electron.launch({executablePath:path.join(root,'electron.exe'),args:[...args,'--user-data-dir='+path.join(dir,name)],env,timeout:25000});const page=await app.firstWindow();await page.screenshot({path:out+'/electron-'+name+'.png'});results.push({name,status:'PASS',version:await app.evaluate(()=>process.versions.electron)});}catch(e){results.push({name,status:'BLOCKED',error:String(e).replace(/eyJ[\w.-]+/g,'[JWT]')});}finally{if(app)await app.close();}
 }
 fs.writeFileSync(out+'/electron-runtime.json',JSON.stringify(results,null,2));console.log(results);
})();
