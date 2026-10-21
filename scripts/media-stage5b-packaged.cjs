const {_electron}=require('C:/Users/Пользователь/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
(async()=>{
 const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
 const app=await _electron.launch({executablePath:path.resolve('artifacts/stages/artifacts/stages/release-stage5b-final2/win-unpacked/Zvonok.exe'),args:['--user-data-dir='+fs.mkdtempSync(path.join(os.tmpdir(),'zvonok-stage5b-packaged-'))],env,timeout:30000});
 const result={};
 try{
 const page=await app.firstWindow();await page.waitForLoadState('domcontentloaded');
 result.runtime=await app.evaluate(({app})=>({packaged:app.isPackaged,electron:process.versions.electron}));assert.equal(result.runtime.packaged,true);
 result.document=await page.evaluate(()=>({protocol:location.protocol,origin:location.origin}));assert.equal(result.document.protocol,'file:');
 const state=JSON.parse(fs.readFileSync(path.join(os.tmpdir(),'zvonok-stage5b-runtime.json')));
 const attachment=state.attachments.find(a=>a.originalFileName==='pages-500.pdf');
 const response=await fetch('http://127.0.0.1:18081/api/message-attachments/'+attachment.id+'/playback-access',{method:'POST',headers:{Authorization:'Bearer '+state.owner.accessToken}});assert.equal(response.status,200);const grant=await response.json();
 result.storage=await page.evaluate(async url=>{try{const r=await fetch(url,{headers:{Range:'bytes=0-99'},credentials:'omit'});return {ok:r.ok,status:r.status,bytes:(await r.arrayBuffer()).byteLength,contentRange:r.headers.get('content-range'),allowOrigin:r.headers.get('access-control-allow-origin')};}catch(e){return {ok:false,error:e.name};}},grant.url);
 result.api=await page.evaluate(async()=>{try{const r=await fetch('http://localhost:18081/api/auth/login',{method:'OPTIONS',headers:{'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'}});return {status:r.status};}catch(e){return {error:e.name};}});
 result.webSecurity=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences().webSecurity!==false);assert.equal(result.webSecurity,true);
 await page.goto(page.url().split('#')[0]+'#/auth/login');await page.locator('[name=usernameOrEmail]').fill(state.owner.name);await page.locator('[name=password]').fill(state.owner.password);await page.locator('form button').click();await page.getByRole('button',{name:'Друзья',exact:true}).first().waitFor({timeout:15000});result.login='PASS';
 await page.evaluate(room=>{location.hash='/dm?roomId='+room;},state.room.id);await page.getByRole('textbox',{name:'Сообщение',exact:true}).waitFor();
 // The full packaged UI suite covers PDF rendering; this probe measures native origin/security.
 await page.screenshot({path:'artifacts/stages/media-stage5b-evidence/packaged.png'});
 result.status=result.storage.ok?'PASS':'BLOCKED';result.reason='Actual packaged file-origin runtime tested with existing security settings. No CORS, permissions, custom protocol or bridge changes applied.';
 }catch(e){result.status='FAIL';result.error=e.message.replace(/https?:\/\/[^\s]+/g,'[URL]');throw e;}
 finally{fs.writeFileSync('artifacts/stages/media-stage5b-evidence/packaged.json',JSON.stringify(result,null,2));await app.close();console.log(result);}
})().catch(e=>{console.error(e.message);process.exitCode=1;});

