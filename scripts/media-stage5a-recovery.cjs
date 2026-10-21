const {chromium}=require('C:/Users/Пользователь/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const {fixture,shortUrl}=require('./media-stage5a-storage.cjs');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true}),results=[];
 try{
 for(const wasPlaying of [false,true]){
  const f=await fixture(),page=await browser.newPage();page.setDefaultTimeout(10000);let grants=0;
  await page.addInitScript(attachment=>{window.__stage5aAttachment=attachment;},f.attachment);
  await page.route('**/api/message-attachments/*/playback-access',async route=>{
   const response=await route.fetch({headers:{Authorization:'Bearer '+f.owner.accessToken}});
   if(!response.ok()){await route.fulfill({response});return;}
   const data=await response.json();grants++;
   // Controlled short TTL on the real object/signature; the refresh still reaches the actual backend.
   data.url=shortUrl(data.url);data.expiresAt=new Date(Date.now()+1500).toISOString();
   await route.fulfill({response,json:data});
  });
  await page.goto('http://localhost:3001/scripts/media-stage5a-spike.html');
  await page.getByRole('button',{name:/Воспроизвести видео/}).click();
  await page.waitForFunction(()=>document.querySelector('video')?.currentTime>0);
  const video=page.locator('video');
  await video.evaluate((v,playing)=>{v.volume=.23;v.playbackRate=1.5;if(!playing)v.pause();},wasPlaying);
  await sleep(2200);await video.evaluate(v=>{v.currentTime=4;});
  await page.waitForFunction(()=>document.querySelector('video')?.readyState>=2);
  const end=Date.now()+10000;while(grants<2&&Date.now()<end)await sleep(100);assert.equal(grants,2);
  await page.waitForFunction(playing=>{const v=document.querySelector('video');return v&&v.currentTime>=3.5&&v.paused===!playing&&v.volume===.23&&v.playbackRate===1.5;},wasPlaying);
  results.push({scenario:'real short signed URL recovery',wasPlaying,grants,status:'PASS'});
  // A removed member may finish the existing capability but cannot renew it.
  const left=await page.request.post('http://127.0.0.1:18081/api/rooms/'+f.room.id+'/leave',{headers:{Authorization:'Bearer '+f.owner.accessToken}});assert.equal(left.status(),204);
  await sleep(2200);await video.evaluate(v=>{v.currentTime=6;});
  await page.getByRole('alert').filter({hasText:'Доступ к файлу больше недоступен'}).waitFor();
  assert.equal(await page.locator('video').count(),0);
  results.push({scenario:'membership loss stops recovery and artifacts/stages/releases media',status:'PASS'});
  await page.close();
 }
 fs.writeFileSync('artifacts/stages/media-stage5a-evidence/recovery.json',JSON.stringify({status:'PASS',results},null,2));
 }catch(e){fs.writeFileSync('artifacts/stages/media-stage5a-evidence/recovery.json',JSON.stringify({status:'FAIL',results,error:e.message.replace(/https?:\/\/[^\s]+/g,'[URL]')},null,2));process.exitCode=1;}
 finally{await browser.close();}
})();
