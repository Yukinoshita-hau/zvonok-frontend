const {chromium,_electron}=require('C:/Users/Пользователь/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const packaged=process.argv.includes('--packaged'),out='artifacts/stages/media-stage5c-evidence/'+(packaged?'packaged':process.argv.includes('--finish')?'browser-finish':'browser');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const state=JSON.parse(fs.readFileSync(path.join(os.tmpdir(),'zvonok-stage5c-runtime.json'))),results=[],errors=[],history=[];
 let app,browser,page,base='http://localhost:3001';
 const record=(scenario,details={})=>{results.push({status:'PASS',scenario,...details});console.log('PASS',scenario);};
 const shot=name=>page.screenshot({path:out+'/'+name+'.png'});
 try {
 if(packaged){const env={...process.env,ZVONOK_DESKTOP_WEB_ORIGIN:'http://localhost:3001'};delete env.ELECTRON_RUN_AS_NODE;app=await _electron.launch({executablePath:path.resolve(process.env.STAGE5C_ELECTRON || 'artifacts/stages/artifacts/stages/artifacts/stages/release-stage5c-final/win-unpacked/Zvonok.exe'),args:['--user-data-dir='+fs.mkdtempSync(path.join(os.tmpdir(),'zvonok-stage5c-packaged-'))],env});page=await app.firstWindow();await page.waitForURL('file://**');base=page.url().split('#')[0]+'#';assert.equal(await app.evaluate(({app})=>app.isPackaged),true);}
 else {browser=await chromium.launch({channel:'chrome',headless:true});page=await browser.newPage({viewport:{width:1366,height:768},acceptDownloads:true});}
 page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/\/rooms\/\d+\/messages(\?|$)/.test(r.url()))history.push(r.url());});
 await page.goto(base+'/auth/login');await page.locator('[name=usernameOrEmail]').fill(state.owner.name);await page.locator('[name=password]').fill(state.owner.password);await page.locator('form button').click();await page.getByRole('button',{name:'Друзья',exact:true}).first().waitFor();
 await page.goto(base+'/dm?roomId='+state.libraryRoom.id);await page.getByRole('textbox',{name:'Сообщение',exact:true}).waitFor();
 const trigger=()=>page.getByRole('button',{name:'Медиа и файлы',exact:true});const library=()=>page.getByRole('dialog',{name:'Медиа и файлы',exact:true});const viewer=()=>page.getByRole('dialog').filter({has:page.locator('button',{hasText:'Скачать оригинал'})});
 await trigger().click();await library().getByRole('button',{name:/^Открыть /}).first().waitFor();await shot('media-grid');record('GROUP library opens');
 if(!process.argv.includes('--finish')) {
 for(const [label,name] of [['Аудио','audio-filter'],['Файлы','files-list']]){await library().getByRole('button',{name:label,exact:true}).click();await library().getByRole('button',{name:/^Открыть /}).first().waitFor();await shot(name);}
 const search=()=>library().getByRole('textbox',{name:'Поиск по имени файла'});
 await search().fill('PDF');await library().getByRole('button',{name:/^Открыть .*pdf$/i}).first().waitFor();await page.waitForTimeout(500);await shot('pdf-search');
 assert.ok((await library().getByRole('button',{name:/^Открыть /}).allTextContents()).every(name=>name.toLowerCase().includes('pdf')));record('file/audio filters and debounced PDF search');
 const beforeHistory=history.length;
 await library().getByRole('button',{name:/^Открыть .*pages-100.pdf$/}).first().click();await viewer().locator('canvas').waitFor();await page.waitForFunction(()=>document.querySelector('.textLayer')?.textContent.includes('Zvonok'));await shot('pdf-viewer');assert.equal(history.length,beforeHistory);await page.keyboard.press('Escape');record('existing PDF viewer without history requests');
 if(!packaged){const event=page.waitForEvent('download');await library().getByRole('button',{name:/^Скачать .*pages-100.pdf$/}).first().click();const download=await event;const bytes=fs.readFileSync(await download.path());assert.deepEqual(bytes,fs.readFileSync('artifacts/stages/media-stage5b-evidence/fixtures/pages-100.pdf'));record('library original download exact bytes');}
 await search().fill('no-such-stage5c-file');await library().getByText('Файлы не найдены',{exact:true}).waitFor();await shot('empty-search');await library().getByRole('button',{name:'Очистить поиск'}).click();await library().getByRole('button',{name:'Все',exact:true}).click();await library().getByRole('button',{name:'Показать ещё',exact:true}).waitFor();const nextPage=page.waitForResponse(r=>r.url().includes('/attachments?')&&r.url().includes('cursor=')&&r.status()===200);await library().getByRole('button',{name:'Показать ещё',exact:true}).click();assert.equal((await (await nextPage).json()).items.length,40);assert.ok(await library().getByRole('button',{name:/^Открыть /}).count()<40);await shot('pagination');record('empty state, clear and cursor pagination');
 await library().getByRole('button',{name:'Изображения',exact:true}).click();await library().getByRole('button',{name:/^Открыть /}).first().click();await viewer().locator('img').waitFor();await viewer().locator('img').evaluate(image=>image.decode());await shot('image-viewer');await page.keyboard.press('Escape');
 }
 await library().getByRole('button',{name:'Видео',exact:true}).click();await library().getByRole('button',{name:/^Открыть .*clip.mp4$/}).first().click();await viewer().getByRole('button',{name:/Воспроизвести/}).click();await page.waitForFunction(()=>document.querySelector('[role=dialog] video')?.currentTime>0);await shot('video-viewer');await page.keyboard.press('Escape');record('existing image/video viewers');
 if(!packaged){for(const [width,height] of [[1920,1080],[1366,768],[1024,768],[1024,600]]){await page.setViewportSize({width,height});const box=await library().boundingBox();assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=width&&box.y+box.height<=height);await shot(`viewport-${width}x${height}`);}record('four responsive viewports');}
 await library().getByRole('button',{name:/^Перейти к сообщению:/}).first().click();await library().waitFor({state:'hidden'});await page.getByRole('button',{name:'К новым сообщениям',exact:true}).waitFor();await page.locator('[class*=message-row-highlighted]').waitFor();await shot('jump-to-message');record('old message context jump and highlight');
 assert.deepEqual(errors,[]);record('no page exceptions');
 }catch(e){results.push({status:'FAIL',error:e.message.replace(/https?:\/\/[^\s]+/g,'[URL]')});console.error(e.stack);await shot('failure').catch(()=>{});process.exitCode=1;}
 finally {fs.writeFileSync(out+'/results.json',JSON.stringify({results,errors,historyRequests:history.length},null,2));await browser?.close();await app?.close();}
})();

