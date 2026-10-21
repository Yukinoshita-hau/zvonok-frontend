const {_electron}=require('C:/Users/Пользователь/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
(async()=>{
 const out='artifacts/stages/ui-redesign-stage4-evidence/electron';fs.mkdirSync(out,{recursive:true});
 const env={...process.env,VITE_DEV_SERVER_URL:'http://localhost:3002',ZVONOK_DESKTOP_WEB_ORIGIN:'http://localhost:3000'};delete env.ELECTRON_RUN_AS_NODE;
 const app=await _electron.launch({executablePath:path.resolve('artifacts/stages/release/win-unpacked.tmp/electron.exe'),args:['--disable-gpu',path.resolve('.'),'--user-data-dir='+fs.mkdtempSync(path.join(os.tmpdir(),'zvonok-stage4-electron-'))],env,timeout:30000});
 try{
  const page=await app.firstWindow();page.setDefaultTimeout(20000);
  await page.goto('http://localhost:3002/auth/register');
  const name='stage4electron'+Date.now();
  await page.locator('[name=username]').fill(name);await page.locator('[name=email]').fill(name+'@test.invalid');await page.locator('[name=password]').fill(require('node:crypto').randomUUID()+'aA1!');
  await page.locator('form button').click();await page.getByRole('button',{name:'Настройки пользователя',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Настройки пользователя',exact:true});await dialog.waitFor();
  await page.screenshot({path:out+'/account.png'});
  await dialog.getByRole('button',{name:'Голос и видео',exact:true}).click();await page.screenshot({path:out+'/devices.png'});
  await dialog.getByRole('button',{name:'Внешний вид',exact:true}).click();await dialog.getByRole('button',{name:/Светлая/}).click();assert.equal(await page.locator('html').getAttribute('data-theme'),'light');await page.screenshot({path:out+'/light.png'});
  await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
  assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('aria-label')),'Настройки пользователя');
  const versions=await app.evaluate(({app})=>({electron:process.versions.electron,chrome:process.versions.chrome,packaged:app.isPackaged}));
  fs.writeFileSync(out+'/result.json',JSON.stringify({status:'PASS',versions,checks:['real registration','account dialog','device settings','light theme','Escape and focus return'],limits:['UI smoke uses --disable-gpu after native GPU process failure','No native call or physical media device test']},null,2));console.log('Electron runtime UI PASS',versions);
 }finally{await app.close();}
})().catch(e=>{fs.writeFileSync('artifacts/stages/ui-redesign-stage4-evidence/electron/result.json',JSON.stringify({status:'BLOCKED',error:String(e)},null,2));console.error(e);process.exitCode=1});
