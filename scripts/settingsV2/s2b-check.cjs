const {chromium}=require(process.env.STAGE10_PLAYWRIGHT || 'C:/Users/Пользователь/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const out='artifacts/stages/work/settings-promotion/account';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1440,height:900}});
 const results=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
 const record=name=>{results.push({name,status:'PASS'});console.log('PASS',name);};
 let server,putFail=false,uploadFail=false,readFail=false,delay=false,puts=0,uploads=0,lastBody;
 const state=()=>page.evaluate(()=>window.settingsFixture.view().user.myUser);
 const account=()=>page.locator('#setting-profile');
 const name=()=>account().getByLabel('Отображаемое имя',{exact:true});
 const bio=()=>account().getByLabel('Обо мне',{exact:true});
 const save=()=>account().getByRole('button',{name:'Сохранить',exact:true});
 const open=()=>page.getByRole('button',{name:'Настройки пользователя',exact:true}).click();
 const section=title=>page.getByRole('navigation',{name:'Разделы настроек',exact:true}).getByRole('button',{name:title,exact:true}).click();
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jYcQAAAAASUVORK5CYII=','base64');
 const file=()=>account().getByLabel('Файл аватара');
 try{
  await page.addInitScript(()=>{window.avatarUrls={created:0,revoked:0};const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);URL.createObjectURL=(...args)=>{window.avatarUrls.created++;return create(...args)};URL.revokeObjectURL=(...args)=>{window.avatarUrls.revoked++;return revoke(...args)};});
  await page.route('**/users/my',async route=>{
   if(route.request().method()==='PUT'){
    puts++;lastBody=route.request().postDataJSON();
    if(delay) await new Promise(r=>setTimeout(r,500));
    if(putFail)return route.fulfill({status:400,json:{message:'Fixture validation failure'}});
    server={...server,...Object.fromEntries(Object.entries(lastBody).filter(([,v])=>v!==null))};
    server.displayName=server.displayName.trim();return route.fulfill({json:server});
   }
   if(readFail)return route.fulfill({status:503,json:{message:'Readback unavailable'}});
   return route.fulfill({json:server});
  });
  await page.route('**/users/upload-avatar',async route=>{
   uploads++;if(uploadFail)return route.fulfill({status:503,json:{message:'Storage unavailable'}});
   server={...server,avatarUrl:`http://127.0.0.1:5199/avatar-fixture-${uploads}.png`};return route.fulfill({status:200,body:''});
  });
  await page.route('**/avatar-fixture-*.png',route=>route.fulfill({contentType:'image/png',body:png}));
  await page.goto('http://127.0.0.1:5199/dm?roomId=42');server=await state();
  await open();await name().waitFor();
  assert.equal(await name().inputValue(),server.displayName);assert(await save().isDisabled());record('draft initialized from existing Redux');
  await name().fill('Имя');await bio().fill('Draft biography');
  assert.equal((await state()).displayName,'Fixture User');assert((await account().getByLabel('Предпросмотр профиля').textContent()).includes('Имя'));record('Unicode draft preview does not mutate Redux');
  await account().getByRole('button',{name:'Отменить',exact:true}).click();assert.equal(await name().inputValue(),server.displayName);record('cancel and reset confirmed values');
  await name().fill('  ');assert(await save().isDisabled());assert.equal(await name().getAttribute('aria-invalid'),'true');
  await name().fill('a'.repeat(51));assert(await save().isDisabled());await name().fill('Новое имя');await bio().fill('');record('field validation and empty biography');
  delay=true;await save().click();await account().getByText('Сохраняем…',{exact:true}).waitFor();assert(await name().isDisabled());
  await account().getByText('Изменения сохранены',{exact:true}).waitFor();delay=false;
  assert.equal((await state()).aboutMe,'');assert.equal(lastBody.avatarUrl,null);record('pending then server acknowledgement with cleared biography');
  await page.reload();await name().waitFor();await page.evaluate(profile=>window.settingsFixture.dispatch({type:'user/addUser',payload:profile}),server);
  await page.waitForFunction(()=>document.querySelector('[id$="-name"]')?.value==='Новое имя');assert.equal(await bio().inputValue(),'');record('fixture readback after reload (not real backend)');
  await name().fill('Unsaved text');putFail=true;await save().click();await account().getByRole('alert').filter({hasText:'валидации'}).waitFor();
  assert.equal(await name().inputValue(),'Unsaved text');assert.equal((await state()).displayName,'Новое имя');
  putFail=false;await save().click();await account().getByText('Изменения сохранены',{exact:true}).waitFor();record('PUT failure preserves draft and retry reconciles');
  await file().setInputFiles({name:'bad.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg/>')});await account().getByRole('alert').filter({hasText:'PNG'}).waitFor();assert.equal(uploads,0);record('unsupported avatar rejected before upload');
  await name().fill('Text retained');await file().setInputFiles({name:'avatar.png',mimeType:'image/png',buffer:png});
  assert((await account().getByAltText('Предпросмотр аватара').getAttribute('src')).startsWith('blob:'));assert.equal(uploads,0);record('local avatar preview before confirmation');
  uploadFail=true;await save().click();await account().getByRole('alert').filter({hasText:'Storage unavailable'}).waitFor();assert.equal(await name().inputValue(),'Text retained');record('upload failure retains text and file');
  uploadFail=false;putFail=true;await save().click();await account().getByRole('alert').filter({hasText:'Аватар сохранён. Текст профиля не сохранён.'}).waitFor();
  assert((await state()).avatarUrl.includes('avatar-fixture'));assert.equal(await name().inputValue(),'Text retained');
  const count=uploads;putFail=false;await save().click();await account().getByText('Изменения сохранены',{exact:true}).waitFor();assert.equal(uploads,count);record('partial upload success, PUT failure, retry without duplicate upload');
  await file().setInputFiles({name:'avatar.png',mimeType:'image/png',buffer:png});const before=puts;await save().click();await account().getByText('Изменения сохранены',{exact:true}).waitFor();assert.equal(puts,before);record('avatar-only save skips unnecessary PUT');
  await file().setInputFiles({name:'avatar.png',mimeType:'image/png',buffer:png});readFail=true;await save().click();
  await account().getByRole('button',{name:'Обновить профиль',exact:true}).waitFor();assert(await save().isDisabled());readFail=false;
  await account().getByRole('button',{name:'Обновить профиль',exact:true}).click();await account().getByRole('button',{name:'Обновить профиль',exact:true}).waitFor({state:'hidden'});record('upload acknowledgement with failed GET requires readback, no reupload');
  await name().fill('Local conflict draft');await page.evaluate(()=>{const p=window.settingsFixture.view().user.myUser;window.settingsFixture.dispatch({type:'user/patchMyUser',payload:{id:p.id,displayName:'External name'}});});
  assert.equal(await name().inputValue(),'Local conflict draft');assert(await save().isDisabled());await account().getByRole('button',{name:'Сбросить',exact:true}).click();assert.equal(await name().inputValue(),'External name');record('external update preserves draft and requires explicit reset');
  await name().fill('Close guard draft');page.once('dialog',dialog=>dialog.dismiss());await page.getByRole('button',{name:'Закрыть настройки',exact:true}).click();assert.equal(await name().inputValue(),'Close guard draft');
  page.once('dialog',dialog=>dialog.dismiss());await section('Внешний вид');assert.equal(await name().inputValue(),'Close guard draft');
  page.once('dialog',dialog=>dialog.accept());await section('Внешний вид');await section('Аккаунт');assert.equal(await name().inputValue(),'External name');record('dirty close and category navigation guards');
  await name().fill('Keyboard draft');await name().press('Tab');assert(await page.evaluate(()=>document.activeElement.tagName==='TEXTAREA'));
  await page.setViewportSize({width:800,height:900});await page.locator('[aria-label="Содержимое настроек"]').evaluate(e=>e.scrollTop=0);await page.screenshot({path:out+'/account-800.png',fullPage:true});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await account().getByRole('button',{name:'Отменить',exact:true}).click();await page.setViewportSize({width:1440,height:900});await page.locator('[aria-label="Содержимое настроек"]').evaluate(e=>e.scrollTop=0);await page.screenshot({path:out+'/account-1440.png',fullPage:true});record('keyboard focus and narrow viewport');
  await page.getByRole('button',{name:'Закрыть настройки',exact:true}).click();await page.evaluate(()=>localStorage.setItem('zvonok.settingsUI','legacy'));await page.getByRole('button',{name:'Настройки пользователя',exact:true}).click();const legacy=page.getByRole('dialog');assert.equal(await legacy.getByLabel('Отображаемое имя',{exact:true}).inputValue(),'External name');
  await legacy.getByLabel('Отображаемое имя',{exact:true}).fill('Legacy update');await legacy.getByRole('button',{name:'Сохранить',exact:true}).click();await legacy.getByText('Изменения сохранены',{exact:true}).waitFor();
  await legacy.getByRole('button',{name:'Закрыть настройки',exact:true}).click();await page.evaluate(()=>localStorage.removeItem('zvonok.settingsUI'));await open();assert.equal(await name().inputValue(),'Legacy update');record('Workspace to Legacy to V2 same Redux and API');
  await page.getByRole('button',{name:'Закрыть настройки',exact:true}).click();await page.evaluate(()=>localStorage.setItem('zvonok.settingsUI','legacy'));await open();await page.getByRole('dialog').getByLabel('Отображаемое имя',{exact:true}).waitFor();await page.getByRole('button',{name:'Закрыть настройки',exact:true}).click();
  await page.evaluate(()=>localStorage.removeItem('zvonok.settingsUI'));await open();assert.equal(await name().inputValue(),'Legacy update');record('flag OFF/ON and Settings to Chat to Settings');
  const urls=await page.evaluate(()=>window.avatarUrls);assert(urls.created>0);assert.equal(urls.created,urls.revoked);record('all local avatar Object URLs artifacts/stages/released');
  await name().fill('History draft');await account().getByText('Есть несохранённые изменения',{exact:true}).waitFor();page.once('dialog',d=>d.dismiss());await page.goBack();await name().waitFor();assert.equal(await name().inputValue(),'History draft');await account().getByRole('button',{name:'Отменить',exact:true}).click();record('browser back cancellation preserves draft');
  assert.deepEqual(errors,[]);
 }catch(error){errors.push(error.stack);console.error(error);process.exitCode=1;await page.screenshot({path:out+'/failure.png',fullPage:true});}
 finally{fs.writeFileSync(out+'/results.json',JSON.stringify({results,errors,acceptance:'fixture only; real API NOT RUN'},null,2));await browser.close();}
})();
