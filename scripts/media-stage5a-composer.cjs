const {chromium}=require('C:/Users/Пользователь/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {fixture}=require('./media-stage5a-storage.cjs');
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const f=await fixture(),page=await browser.newPage();page.setDefaultTimeout(15000);
  const backendBodies=[];
  page.on('request',r=>{if(r.method()==='GET'&&/\/message-attachments\/\d+\/(?:stream|download)/.test(r.url()))backendBodies.push(new URL(r.url()).pathname);});
  await page.goto('http://localhost:3001/auth/login');await page.locator('[name=usernameOrEmail]').fill(f.owner.name);
  await page.locator('[name=password]').fill(f.owner.password);await page.locator('form button').click();
  await page.getByRole('button',{name:'Друзья',exact:true}).first().waitFor();
  await page.goto('http://localhost:3001/dm?roomId='+f.room.id);
  await page.getByRole('textbox',{name:'Сообщение',exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:/Записать голосовое|Записать видео|Начать запись/}).count(),0);
  await page.locator('input[type=file][accept*="audio/mpeg"]').setInputFiles({name:'ordinary.mp3',mimeType:'audio/mpeg',buffer:fs.readFileSync('artifacts/stages/media-stage5a-evidence/ordinary.mp3')});
  await page.getByText('Аудиофайл',{exact:true}).waitFor();
  const sent=page.waitForResponse(r=>r.url().includes('/messages/attachments')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Отправить сообщение',exact:true}).click();
  const response=await sent;assert.equal(response.status(),200);const message=await response.json();assert.equal(message.attachments[0].type,'AUDIO');
  const card=page.locator(`[data-attachment-player="${message.attachments[0].id}"]`);
  await card.getByRole('button',{name:/Воспроизвести аудио/}).click();
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('audio')).some(a=>a.currentTime>0));
  const videoCard=page.locator(`[data-attachment-player="${f.attachment.id}"]`);
  await videoCard.getByRole('button',{name:/Воспроизвести видео/}).click();
  await page.waitForFunction(()=>document.querySelector('video')?.currentTime>0);
  const video=videoCard.locator('video');await video.evaluate(v=>v.pause());
  const timeline=videoCard.locator('.media-time-slider');const box=await timeline.boundingBox();
  assert.ok(box);await timeline.click({position:{x:box.width*.6,y:box.height/2}});
  await page.waitForFunction(()=>{const v=document.querySelector('video');return v&&!v.seeking&&Math.abs(v.currentTime-v.duration*.6)<.8;});
  await videoCard.getByRole('button',{name:'Mute',exact:true}).click();assert.equal(await video.evaluate(v=>v.muted),true);
  await videoCard.getByRole('button',{name:'Unmute',exact:true}).click();assert.equal(await video.evaluate(v=>v.muted),false);
  await videoCard.getByRole('button',{name:'Settings',exact:true}).click();
  await page.getByRole('menuitem',{name:/Speed/}).click();
  await page.getByRole('menuitemradio',{name:/1\.5/}).click();
  assert.equal(await video.evaluate(v=>v.playbackRate),1.5);await page.keyboard.press('Escape');
  assert.equal(backendBodies.length,0,'playback must bypass backend byte endpoints');
  assert.ok(await page.evaluate(()=>!Object.values(localStorage).some(value=>/X-Amz-Signature|AWSAccessKeyId|Signature=/.test(value))));
  const download=page.waitForEvent('download');await card.getByRole('button',{name:'Скачать оригинал',exact:true}).click();
  const original=await download;assert.equal(original.suggestedFilename(),'ordinary.mp3');
  const saved=fs.readFileSync(await original.path());const source=fs.readFileSync('artifacts/stages/media-stage5a-evidence/ordinary.mp3');
  assert.deepEqual(saved,source);
  fs.writeFileSync('artifacts/stages/media-stage5a-evidence/composer.json',JSON.stringify({status:'PASS',checks:['no recorder UI','ordinary audio picker','existing multipart contract','private S3 audio/video playback','timeline pointer seek','mute/unmute buttons','speed menu 1.5x','no persisted signed URLs','original download exact bytes'],backendMediaBodyRequestsDuringPlayback:0,backendMediaBodyBytesDuringPlayback:0,bytes:source.length,sha256:crypto.createHash('sha256').update(saved).digest('hex')},null,2));
 }catch(e){fs.writeFileSync('artifacts/stages/media-stage5a-evidence/composer.json',JSON.stringify({status:'FAIL',error:e.message.replace(/https?:\/\/[^\s]+/g,'[URL]')},null,2));process.exitCode=1;}
 finally{await browser.close();}
})();
