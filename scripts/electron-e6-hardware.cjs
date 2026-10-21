const { _electron }=require(process.env.STAGE10_PLAYWRIGHT || 'C:/Users/Пользователь/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const out=path.resolve('artifacts/stages/electron-e6/hardware');fs.mkdirSync(out,{recursive:true});const rows=[];let desktop;
(async()=>{try{
  const username='e6hw'+Date.now(),password=crypto.randomBytes(18).toString('hex');
  const registered=await fetch('http://127.0.0.1:18086/api/auth/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username,password,email:username+'@example.com'})});assert(registered.ok);
  const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
  desktop=await _electron.launch({executablePath:path.resolve('artifacts/stages/electron-e6/package/win-unpacked/Zvonok.exe'),args:['--user-data-dir='+path.join(out,'profile-'+Date.now())],env,timeout:20000});
  await desktop.context().addInitScript(()=>{
    window.e6Hardware={captures:0,errors:[],tracks:[]};const gum=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia=async constraints=>{window.e6Hardware.captures++;try{const stream=await gum(constraints);window.e6Hardware.tracks.push(...stream.getTracks());return stream;}catch(error){window.e6Hardware.errors.push(error.name);throw error;}};
  });
  const page=await desktop.firstWindow();page.setDefaultTimeout(15000);await page.reload();
  await page.locator('[name=usernameOrEmail]').fill(username);await page.locator('[name=password]').fill(password);await page.getByRole('button',{name:'Вход',exact:true}).click();
  await page.getByRole('button',{name:'Настройки пользователя',exact:true}).click();await page.getByRole('navigation',{name:'Разделы настроек',exact:true}).getByRole('button',{name:'Голос и видео',exact:true}).click();
  const devices=await page.evaluate(async()=>{const devices=await navigator.mediaDevices.enumerateDevices();return ['audioinput','videoinput','audiooutput'].map(kind=>({kind,count:devices.filter(d=>d.kind===kind).length}));});
  assert.equal(await page.evaluate(()=>window.e6Hardware.captures),0);rows.push({name:'Real hardware enumeration and permission disclosure open without capture',status:'PASS',devices});
  for(const [kind,tab,button] of [['audio','Микрофон','Послушать себя'],['video','Камера','Проверить камеру']]){
    await page.getByRole('tab',{name:tab,exact:true}).click();
    if(!devices.find(d=>d.kind===(kind==='audio'?'audioinput':'videoinput')).count){rows.push({name:kind+' platform device preview',status:'NOT RUN',reason:'Platform reports no device'});continue;}
    const failures=await page.evaluate(()=>window.e6Hardware.errors.length);
    await page.getByRole('button',{name:button,exact:true}).click();
    await page.waitForFunction(({kind,failures})=>window.e6Hardware.tracks.some(t=>t.kind===kind&&t.readyState==='live')||window.e6Hardware.errors.length>failures,{kind,failures},{timeout:10000});
    const live=await page.evaluate(kind=>window.e6Hardware.tracks.some(t=>t.kind===kind&&t.readyState==='live'),kind);
    rows.push({name:kind+' platform device preview',status:live?'PASS':'FAIL',errors:await page.evaluate(()=>window.e6Hardware.errors),scope:'Real platform capture; no fake capture flags; audibility and image content not recorded'});
  }
  await page.getByRole('button',{name:'Закрыть настройки',exact:true}).click();await page.waitForTimeout(300);
  const ended=await page.evaluate(()=>window.e6Hardware.tracks.every(t=>t.readyState==='ended'));assert(ended);rows.push({name:'All actual preview tracks stop when Settings closes',status:'PASS'});
  await page.getByRole('button',{name:'Настройки пользователя',exact:true}).click();
  await page.getByRole('navigation',{name:'Разделы настроек',exact:true}).getByRole('button',{name:'Аккаунт',exact:true}).click();
  page.on('dialog',dialog=>dialog.accept());
  const logout=page.waitForResponse(response=>response.url().endsWith('/auth/logout')&&response.request().method()==='POST');
  await page.getByRole('button',{name:'Выйти',exact:true}).click();
  const response=await logout;assert.equal(response.status(),200);assert.equal((await response.json()).allDevices,false);
  await page.getByText('Сервер подтвердил выход из текущего сеанса.',{exact:true}).waitFor();
  rows.push({name:'Ordinary logout reaches real backend and confirms current-session scope',status:'PASS'});
  await page.locator('[name=usernameOrEmail]').fill(username);await page.locator('[name=password]').fill(password);
  await page.getByRole('button',{name:'Вход',exact:true}).click();await page.locator('[aria-label="Панель пользователя"]').waitFor();
  rows.push({name:'Real re-login after ordinary logout',status:'PASS'});
}catch(error){rows.push({name:'hardware campaign',status:'FAIL',reason:error.message.split('\n')[0]});}finally{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(rows,null,2));console.log(JSON.stringify(rows));await desktop?.close();if(rows.some(row=>row.status==='FAIL'))process.exitCode=1;}})();
