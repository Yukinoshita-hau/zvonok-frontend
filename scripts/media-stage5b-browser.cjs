const {chromium}=require('C:/Users/Пользователь/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
let base='http://localhost:3001';const out='artifacts/stages/media-stage5b-evidence/'+(process.argv.includes('--packaged')?'packaged-ui':process.argv.includes('--electron')?'electron':'browser');
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const runtime=JSON.parse(fs.readFileSync(path.join(os.tmpdir(),'zvonok-stage5b-runtime.json')));
 const browser=process.argv.includes('--electron')||process.argv.includes('--packaged')?await require('./media-stage5b-electron.cjs').launch({channel:'chrome',headless:true}):await chromium.launch({channel:'chrome',headless:true});
 if(process.argv.includes('--packaged'))base=(await browser.newPage()).url().split('#')[0]+'#';
 const context=await browser.newContext({viewport:{width:1366,height:768}}),page=await context.newPage(),results=[],errors=[],ranges=[],backendBodies=[];
 page.on('request',request=>{if(request.method()==='GET'&&/\/message-attachments\/\d+\/(download|stream)(\?|$)/.test(request.url()))backendBodies.push(new URL(request.url()).pathname);});
 page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));
 page.on('response',async response=>{if(response.url().includes('X-Amz-Signature')){const h=await response.allHeaders();ranges.push({status:response.status(),range:response.request().headers().range,contentRange:h['content-range'],bytes:h['content-length']});}});
 const record=(scenario,details={})=>{results.push({status:'PASS',scenario,...details});console.log('PASS',scenario);};
 const shot=async name=>page.screenshot({path:out+'/'+name+'.png'});
 const dialog=()=>page.getByRole('dialog');
 const card=name=>page.getByRole('button').filter({has:page.locator('span',{hasText:new RegExp('^'+name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$')})}).first();
 const open=async name=>{const button=card(name);for(let i=0;i<40&&!await button.count();i++){await page.locator('[data-id]').first().evaluate(el=>{let node=el.parentElement;while(node&&getComputedStyle(node).overflowY!=='auto')node=node.parentElement;node?.scrollTo(0,0);});await page.waitForTimeout(750);}await button.scrollIntoViewIfNeeded();await button.click();await dialog().waitFor();};
 try{
 await page.goto(base+'/auth/login');await page.locator('[name=usernameOrEmail]').fill(runtime.owner.name);await page.locator('[name=password]').fill(runtime.owner.password);await page.locator('form button').click();
 await page.getByRole('button',{name:'Друзья',exact:true}).first().waitFor();await page.goto(base+'/dm?roomId='+runtime.room.id);await page.getByRole('textbox',{name:'Сообщение',exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:/Записать голосовое|Записать видео|Начать запись/}).count(),0);record('recording UI absent');
 for(const count of [1,20,100,500]){
  await open('pages-'+count+'.pdf');await dialog().locator('canvas').waitFor();
  await page.waitForFunction(()=>document.querySelector('.textLayer')?.textContent.includes('Zvonok Stage 5B'));
  assert.equal(await dialog().locator('canvas').count(),1);assert.ok((await dialog().innerText()).includes('/ '+count));
  await dialog().getByRole('button',{name:'По ширине',exact:true}).click();await dialog().getByRole('button',{name:'Увеличить PDF',exact:true}).click();await dialog().getByRole('button',{name:'Повернуть',exact:true}).click();
  await dialog().getByRole('textbox').count();
  await dialog().getByRole('spinbutton',{name:'Страница PDF'}).fill(String(count));
  await page.waitForFunction(count=>document.querySelector('.textLayer')?.textContent.includes('page '+count+' of '+count),count);
  assert.equal(await dialog().locator('canvas').count(),1);
  if(count===100){for(let i=0;i<3;i++)await dialog().getByRole('button',{name:'Повернуть',exact:true}).click();await dialog().getByRole('button',{name:'Страница целиком',exact:true}).click();for(const [width,height] of [[1920,1080],[1366,768],[1024,768],[1024,600]]){await page.setViewportSize({width,height});await page.waitForTimeout(150);await dialog().getByText('Загрузка PDF…',{exact:true}).waitFor({state:'hidden'});assert.ok(await dialog().evaluate(el=>{const r=el.getBoundingClientRect();return r.width<=innerWidth&&r.height<=innerHeight;}));assert.ok(await dialog().locator('canvas').evaluate(canvas=>{const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]>0&&pixels[i]<150)return true;return false;}),'PDF must paint visible content');await shot('pdf-'+width+'x'+height);}}
  for(let i=0;i<4;i++){await page.keyboard.press('Tab');assert.ok(await dialog().evaluate(el=>el.contains(document.activeElement)));}
  record(count+' page PDF, selectable text, navigation, zoom, fit, rotation',{activeCanvas:1});await page.keyboard.press('Escape');assert.equal(await dialog().count(),0);assert.ok(await page.evaluate(name=>document.activeElement?.textContent.includes(name),'pages-'+count+'.pdf'));
 }
 assert.ok(ranges.some(r=>r.status===206&&r.range&&r.contentRange));record('PDF.js browser made real S3 Range requests',{rangeRequests:ranges.filter(r=>r.status===206).length});
 for(const file of ['preview.txt','preview.md','preview.json','preview.csv','large.txt']){await open(file);await dialog().locator('pre').waitFor();assert.equal(await dialog().locator('script,img').count(),0);if(file==='large.txt')assert.ok((await dialog().locator('pre').innerText()).length<=262144);await shot(file.replace('.','-'));await page.keyboard.press('Escape');}
 record('bounded raw TXT/MD/JSON/CSV, no HTML execution');
 for(const [name,mime] of [['landscape.png','image/png'],['portrait.png','image/png'],['animation.gif','image/gif'],['sample.webp','image/webp']]){
  await page.locator('input[type=file]').setInputFiles({name,mimeType:mime,buffer:fs.readFileSync('artifacts/stages/media-stage5b-evidence/fixtures/'+name)});
  const sent=page.waitForResponse(r=>r.url().includes('/messages/attachments')&&r.request().method()==='POST');await page.getByRole('button',{name:'Отправить сообщение',exact:true}).click();assert.equal((await sent).status(),200);
  await open(name);await page.waitForFunction(()=>document.querySelector('[role=dialog] img')?.naturalWidth>0);const image=dialog().locator('img');await image.dblclick();
  const box=await image.locator('..').boundingBox();const before=await image.evaluate(el=>el.style.transform);await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+80,box.y+box.height/2+60,{steps:5});await page.mouse.up();assert.notEqual(await image.evaluate(el=>el.style.transform),before);
  await dialog().getByRole('button',{name:'Вписать / сбросить',exact:true}).click();await shot(name.replace('.','-'));await page.keyboard.press('Escape');
 }
 record('landscape/portrait PNG, GIF/WebP, double-click zoom, pan and reset');
 await open('image.png');await dialog().locator('img').waitFor();await page.waitForFunction(()=>document.querySelector('[role=dialog] img')?.naturalWidth>0);
 await dialog().getByRole('button',{name:'Увеличить изображение',exact:true}).click();assert.ok((await dialog().innerText()).includes('125%'));await dialog().getByRole('button',{name:'Реальный размер',exact:true}).click();await dialog().getByRole('button',{name:'Вписать / сбросить',exact:true}).click();await shot('image');await page.keyboard.press('Escape');record('image load, zoom, actual size and reset');
 for(const file of ['document.docx','archive.zip']){await open(file);await dialog().getByText('Встроенный предпросмотр недоступен.',{exact:false}).waitFor();const click=()=>dialog().getByRole('button',{name:'Скачать оригинал',exact:true}).click();let original;if(browser.download)original=await browser.download(click);else{const download=page.waitForEvent('download');await click();original=await download;}assert.deepEqual(fs.readFileSync(await original.path()),fs.readFileSync('artifacts/stages/media-stage5b-evidence/fixtures/'+file));await shot(file.replace('.','-'));await page.keyboard.press('Escape');}
 record('Office and ZIP fallback, original bytes');
 await open('corrupt.pdf');await dialog().getByRole('alert').waitFor();await shot('corrupt-pdf');await page.keyboard.press('Escape');record('corrupt PDF error does not block chat');
 const composer=page.getByRole('textbox',{name:'Сообщение',exact:true});
 const payload=name=>({name,mimeType:'text/plain',buffer:fs.readFileSync('artifacts/stages/media-stage5b-evidence/fixtures/preview.txt')});
 await page.locator('input[type=file]').setInputFiles([payload('composer-a.txt'),payload('composer-b.txt')]);await composer.fill('Stage 5B composer text');
 const sent=page.waitForResponse(r=>r.url().includes('/messages/attachments')&&r.request().method()==='POST');await page.getByRole('button',{name:'Отправить сообщение',exact:true}).click();const response=await sent;assert.equal(response.status(),200);const message=await response.json();assert.equal(message.attachments.length,2);assert.equal(message.content,'Stage 5B composer text');assert.equal(await composer.inputValue(),'');record('multiple files + text via real composer');
 await composer.evaluate(el=>{const dt=new DataTransfer();dt.items.add(new File(['drop'],'drop.txt',{type:'text/plain'}));el.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt}));});await page.getByText('drop.txt',{exact:true}).waitFor();await page.getByRole('button',{name:'Удалить вложение',exact:true}).click();record('drag-and-drop and remove before send');
 await composer.evaluate((el,png)=>{const bytes=Uint8Array.from(atob(png),c=>c.charCodeAt(0)),dt=new DataTransfer();dt.items.add(new File([bytes],'paste.png',{type:'image/png'}));el.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:dt}));},'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1cAAAAASUVORK5CYII=');
 await page.getByText('paste.png',{exact:true}).waitFor();await page.getByRole('button',{name:'Удалить вложение',exact:true}).click();record('clipboard file event selects image');
 // Exercise the real commit, then lose its response once. A manual retry must reuse clientRequestId.
 await page.locator('input[type=file]').setInputFiles(payload('retry.txt'));await composer.fill('Keep this draft');const keys=[];let first=true;
 await page.route('**/rooms/*/messages/attachments',async route=>{const body=route.request().postDataBuffer().toString('utf8');keys.push(body.match(/name="clientRequestId"\r\n\r\n([^\r]+)/)?.[1]);if(first){first=false;await route.fetch();await route.abort('connectionreset');}else await route.continue();});
 await page.getByRole('button',{name:'Отправить сообщение',exact:true}).click();await page.getByRole('button',{name:'Отправить сообщение',exact:true}).waitFor({state:'visible'});await page.waitForTimeout(1000);assert.equal(await composer.inputValue(),'Keep this draft');
 const retried=page.waitForResponse(r=>r.url().includes('/messages/attachments')&&r.request().method()==='POST');await page.getByRole('button',{name:'Отправить сообщение',exact:true}).click();assert.equal((await retried).status(),200);assert.ok(keys[0]);assert.equal(keys[0],keys[1]);await page.unroute('**/rooms/*/messages/attachments');record('lost response retry retains draft and clientRequestId');
 const cdp=await context.newCDPSession(page),samples=[];
 for(let i=0;i<12;i++){await open('pages-100.pdf');await page.waitForFunction(()=>document.querySelector('.textLayer')?.textContent.includes('Zvonok'));await page.keyboard.press('Escape');await page.waitForFunction(()=>document.querySelectorAll('canvas,.textLayer').length===0);if([0,5,11].includes(i)){await cdp.send('HeapProfiler.collectGarbage');samples.push({cycle:i+1,workers:page.workers().length,...await cdp.send('Memory.getDOMCounters')});}}
 assert.ok(samples.every(sample=>sample.workers===0));record('12 PDF open/close cycles clean canvas/text layers/workers',{samples});
 assert.deepEqual(errors,[]);record('no uncaught renderer errors');
 assert.equal(backendBodies.length,0);record('preview and original download bypass backend binary body',{backendBinaryRequests:0});
 }catch(e){results.push({status:'FAIL',error:e.message.replace(/https?:\/\/[^\s]+/g,'[URL]')});await shot('failure').catch(()=>{});console.error(e.stack);process.exitCode=1;}
 finally{fs.writeFileSync(out+'/results.json',JSON.stringify({results,errors,ranges},null,2));await browser.close();}
})();



