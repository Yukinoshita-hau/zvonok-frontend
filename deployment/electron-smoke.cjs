const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {_electron}=require(process.env.STAGE10_PLAYWRIGHT||'C:/Users/Пользователь/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const state=JSON.parse(fs.readFileSync(path.join(os.tmpdir(),'zvonok-stage5e-runtime.json'))),out=path.resolve('media-stage5e-evidence'),env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
 const executable=process.env.STAGE5E_ELECTRON||path.join(os.tmpdir(),'zvonok-stage5e/desktop-package/win-unpacked/ZvonokStage5E.exe');
 const app=await _electron.launch({executablePath:executable,args:['--user-data-dir='+fs.mkdtempSync(path.join(os.tmpdir(),'stage5e-electron-profile-'))],env});
 const result={status:'FAIL'};let page;
 try{
  page=await app.firstWindow();page.setDefaultTimeout(30000);await page.waitForURL('file://**');
  result.packaged=await app.evaluate(({app})=>app.isPackaged);assert.equal(result.packaged,true);
  result.webSecurity=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences().webSecurity!==false);assert.equal(result.webSecurity,true);
  result.electron=await app.evaluate(()=>process.versions.electron);
  const fileBase=page.url().split('#')[0];await page.goto(fileBase+'#/auth/login');await page.locator('[name=usernameOrEmail]').fill(state.owner.name);await page.locator('[name=password]').fill(state.owner.password);
  const response=page.waitForResponse(r=>r.url()==='http://localhost:13000/api/auth/login');await page.locator('form button').click();const login=await response;result.fileOriginLoginStatus=login.status();
  result.handshake=await page.evaluate(token=>new Promise((resolve,reject)=>{const ws=new WebSocket('ws://localhost:13000/api/ws-raw',['v12.stomp','zvonok.auth.'+token]);const timeout=setTimeout(()=>{ws.close();reject(Error('Handshake timeout'));},15000);ws.onopen=()=>{ws.send('CONNECT\naccept-version:1.2\nheart-beat:0,0\nAuthorization:Bearer '+token+'\n\n\0');};ws.onmessage=e=>{if(String(e.data).startsWith('CONNECTED')){clearTimeout(timeout);resolve({urlHasQuery:!!new URL(ws.url).search,protocol:ws.protocol,connected:true});ws.close();}};ws.onerror=()=>{clearTimeout(timeout);reject(Error('WebSocket upgrade failed'));};}),state.owner.accessToken);
  assert.equal(result.handshake.urlHasQuery,false);assert.equal(result.handshake.protocol,'v12.stomp');assert.equal(result.handshake.connected,true);
  assert.equal(login.status(),200,'Packaged file-origin login must pass exact CORS policy');
  await page.getByRole('button',{name:'Друзья',exact:true}).first().waitFor();result.status='PASS';
 }catch(error){result.error=error.message.replace(/https?:\/\/\S+/g,'[URL]');process.exitCode=1;}
 finally{await page?.screenshot({path:out+'/electron.png'}).catch(()=>{});fs.writeFileSync(out+'/electron.json',JSON.stringify(result,null,2));console.log(result);await app.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
