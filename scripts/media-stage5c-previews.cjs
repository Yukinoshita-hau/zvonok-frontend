const {chromium}=require('C:/Users/Пользователь/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const state=JSON.parse(fs.readFileSync(path.join(os.tmpdir(),'zvonok-stage5c-runtime.json'))),result={status:'FAIL'},browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage({viewport:{width:1366,height:768}}),active=new Set(),errors=[],accessResponses=[];let peak=0,grants=0,history=0,opened=false;
 page.on('response',r=>{if(r.url().includes('/playback-access'))accessResponses.push(r.status());});
 page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(r.url().includes('/playback-access')){active.add(r);peak=Math.max(peak,active.size);grants++;}if(opened&&/\/rooms\/\d+\/messages(\?|$)/.test(r.url()))history++;});
 for(const event of ['requestfinished','requestfailed'])page.on(event,r=>active.delete(r));
 try {
  await page.goto('http://localhost:3001/auth/login');await page.locator('[name=usernameOrEmail]').fill(state.owner.name);await page.locator('[name=password]').fill(state.owner.password);await page.locator('form button').click();await page.getByRole('button',{name:'Друзья',exact:true}).first().waitFor();
  await page.goto('http://localhost:3001/dm?roomId='+state.libraryRoom.id);await page.getByRole('textbox',{name:'Сообщение',exact:true}).waitFor();await page.locator('[data-id]').first().waitFor();
  opened=true;await page.getByRole('button',{name:'Медиа и файлы',exact:true}).click();const lib=page.getByRole('dialog',{name:'Медиа и файлы',exact:true});
  await lib.locator('img').first().waitFor();await lib.locator('img').first().evaluate(image=>image.decode());
  assert.ok(peak<=4);assert.ok(grants<40);assert.equal(await lib.locator('video,canvas').count(),0);assert.equal(history,0);
  await page.screenshot({path:'artifacts/stages/media-stage5c-evidence/browser/media-grid-previews.png'});
  result.preview={peakConcurrentGrants:peak,grants,decodedImages:await lib.locator('img').count(),historyRequests:history};
  await lib.getByRole('button',{name:'Все',exact:true}).click();await lib.getByRole('button',{name:'Показать ещё',exact:true}).waitFor();
  for(let i=0;i<5;i++){const response=page.waitForResponse(r=>r.url().includes('/attachments?')&&r.url().includes('cursor=')&&r.status()===200);await lib.getByRole('button',{name:'Показать ещё',exact:true}).click();await response;}
  result.renderedRows=await lib.locator('article').count();assert.ok(result.renderedRows<50);
  await page.screenshot({path:'artifacts/stages/media-stage5c-evidence/browser/windowed-library.png'});
  await page.route('**/attachments?**',route=>route.request().url().includes('network-failure-stage5c')?route.abort():route.continue());
  await lib.getByRole('textbox',{name:'Поиск по имени файла'}).fill('network-failure-stage5c');await lib.getByRole('alert').waitFor();await page.screenshot({path:'artifacts/stages/media-stage5c-evidence/browser/error-retry.png'});
  await page.unroute('**/attachments?**');await lib.getByRole('button',{name:'Повторить',exact:true}).click();await lib.getByText('Файлы не найдены',{exact:true}).waitFor();result.errorRetry=true;
  await lib.getByRole('textbox',{name:'Поиск по имени файла'}).fill('PDF');await lib.getByRole('button',{name:/^Открыть .*pdf$/i}).first().waitFor();
  assert.deepEqual(errors,[]);result.status='PASS';
 }catch(e){result.error=e.message;process.exitCode=1;await page.screenshot({path:'artifacts/stages/media-stage5c-evidence/browser/preview-failure.png'}).catch(()=>{});}
 finally {Object.assign(result,{grants,peak,accessResponses});fs.writeFileSync('artifacts/stages/media-stage5c-evidence/preview-results.json',JSON.stringify(result,null,2));console.log(result);await browser.close();}
})();
