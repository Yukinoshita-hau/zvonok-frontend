const {chromium}=require('C:/Users/Пользователь/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {fixture}=require('./media-stage5a-storage.cjs');
const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true}),results=[];
 const open=async(f,delay=0)=>{
  const p=await browser.newPage();p.setDefaultTimeout(10000);
  await p.addInitScript(attachment=>{window.__stage5aAttachment=attachment;},f.attachment);
  await p.route('**/api/message-attachments/*/playback-access',async route=>{
   const response=await route.fetch({headers:{Authorization:'Bearer '+f.owner.accessToken}});
   if(delay)await new Promise(r=>setTimeout(r,delay));
   await route.fulfill({response}).catch(()=>{});
  });
  await p.goto('http://localhost:3001/scripts/media-stage5a-spike.html');return p;
 };
 try{
 for(const [file,mime] of [['corrupt.webm','video/webm'],['unsupported.mp4','video/mp4']]){
  const f=await fixture(file,mime),p=await open(f);
  await p.getByRole('button',{name:/Воспроизвести видео/}).click();
  await p.getByRole('alert').filter({hasText:/Формат или кодек/}).waitFor();
  results.push({file,status:'PASS',mediaError:await p.locator('video').evaluate(v=>v.error?.code)});await p.close();
 }
 const f=await fixture(),p=await open(f);let last;
 for(let i=0;i<5;i++){
  await p.getByRole('button',{name:/Воспроизвести видео/}).click();
  await p.waitForFunction(()=>document.querySelector('video')?.currentTime>0);
  const video=p.locator('video');last=await video.elementHandle();
  await p.getByRole('button',{name:'Закрыть видео',exact:true}).click();
  assert.equal(await p.locator('video').count(),0);
  assert.deepEqual(await last.evaluate(v=>({paused:v.paused,src:v.getAttribute('src'),connected:v.isConnected})),{paused:true,src:null,connected:false});
  await last.dispose();
 }
 results.push({scenario:'five real private S3 open/close cycles artifacts/stages/release src and media elements',status:'PASS'});
 await p.getByRole('button',{name:/Воспроизвести видео/}).click();
 await p.waitForFunction(()=>document.querySelector('video')?.currentTime>0);
 const video=p.locator('video');await video.evaluate(v=>v.pause());
 const composer=p.getByRole('textbox',{name:'Fixture composer'});await composer.fill('typing');await composer.press('Space');await composer.press('k');
 assert.equal(await composer.inputValue(),'typing k');assert.equal(await video.evaluate(v=>v.paused),true);
 const buttons=await p.getByRole('button').evaluateAll(nodes=>nodes.map(n=>({label:n.getAttribute('aria-label'),text:n.textContent})));
 fs.writeFileSync('artifacts/stages/media-stage5a-evidence/player-controls.json',JSON.stringify(buttons,null,2));
 await p.getByRole('button',{name:'Play',exact:true}).focus();await p.keyboard.press('Space');
 await p.waitForFunction(()=>document.querySelector('video')?.paused===false);
 results.push({scenario:'keyboard Play and composer shortcut isolation',status:'PASS'});await p.close();
 const pending=await open(f,1500);await pending.getByRole('button',{name:/Воспроизвести видео/}).click();
 await pending.getByRole('button',{name:'Закрыть видео',exact:true}).click();await pending.waitForTimeout(2000);
 assert.equal(await pending.locator('video').count(),0);results.push({scenario:'close ignores pending access response',status:'PASS'});await pending.close();
 // Browser-visible CORS on the primary web origin, and no wildcard permission on the old Stage4 origin.
 const origins=await browser.newPage();await origins.goto('http://localhost:3000');
 const cors=await origins.evaluate(async url=>{const r=await fetch(url,{headers:{Range:'bytes=100-199'}});return {status:r.status,range:r.headers.get('content-range'),bytes:(await r.arrayBuffer()).byteLength};},f.descriptor.url);
 assert.equal(cors.status,206);assert.equal(cors.bytes,100);results.push({scenario:'real browser CORS localhost:3000',...cors,status:'PASS',httpStatus:cors.status});await origins.close();
 fs.writeFileSync('artifacts/stages/media-stage5a-evidence/lifecycle.json',JSON.stringify({status:'PASS',results},null,2));
 }catch(e){fs.writeFileSync('artifacts/stages/media-stage5a-evidence/lifecycle.json',JSON.stringify({status:'FAIL',results,error:e.message.replace(/https?:\/\/[^\s]+/g,'[URL]')},null,2));process.exitCode=1;}
 finally{await browser.close();}
})();

