const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');

exports.run = async ({ a,b,c,dm,other,out,record,until,http,shot,saveIdentity,assertIdentity,hangup,rtp,bytes }) => {
  const page = a.page, base = process.env.UI_STAGE_BASE;
  page.setDefaultTimeout(10000);
  const api = process.env.UI_STAGE_API || base+'/api';
  const grants = [], requests = [];
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable'); await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
  const mediaRequests=new Set();let received=0;
  cdp.on('Network.requestWillBeSent',event=>{if(/X-Amz-Signature|Signature=/.test(event.request.url))mediaRequests.add(event.requestId);});
  cdp.on('Network.dataReceived',event=>{if(mediaRequests.has(event.requestId))received+=event.dataLength;});
  page.on('response', async response => {
    const url = response.url();
    if (/X-Amz-Signature|Signature=/.test(url)) {
      const h = await response.allHeaders();
      requests.push({status:response.status(),host:new URL(url).host,range:response.request().headers()['range'],
        contentRange:h['content-range'],length:h['content-length'],allowOrigin:h['access-control-allow-origin'],
        expose:h['access-control-expose-headers']});
    }
    if(url.includes('/playback-access') && response.ok()) grants.push(await response.json());
  });
  await saveIdentity(a); await saveIdentity(b);
  const before = await Promise.all([a,b].map(rtp));
  const contextsBefore = await page.evaluate(()=>window.__audioContexts.length);
  await page.getByRole('button',{name:'Свернуть звонок',exact:true}).first().click();
  const upload = async (file,type,mime,room=dm.id) => {
    const r = await page.request.post(api+`/rooms/${room}/messages/attachments`,{
      headers:{Authorization:'Bearer '+a.token}, multipart:{clientRequestId:crypto.randomUUID(),attachmentType:type,
        files:{name:file.split('/').pop(),mimeType:mime,buffer:fs.readFileSync(file)}}});
    assert.equal(r.status(),200,'upload '+type);
    return (await r.json()).attachments[0];
  };
  const mp4 = await upload('artifacts/stages/media-stage5a-evidence/progressive.mp4','VIDEO','video/mp4');
  record('real 25MB private S3 upload');
  const webm = await upload('artifacts/stages/media-stage5a-evidence/clip.webm','VIDEO','video/webm');
  const audio = await upload('artifacts/stages/media-stage5a-evidence/legacy-audio.webm','AUDIO','audio/webm');
  const note = await upload('artifacts/stages/media-stage5a-evidence/clip.webm','VIDEO_NOTE','video/webm');
  // Refresh the history using the existing route, without page reload or replacing the call Room.
  await page.getByRole('button',{name:'Друзья',exact:true}).first().click();
  await page.evaluate(id=>{history.pushState(null,'','/dm?roomId='+id);window.dispatchEvent(new PopStateEvent('popstate'));},dm.id);
  const card = id => page.locator(`[data-attachment-player="${id}"]`);
  await card(mp4.id).waitFor();
  assert.equal(await page.locator('[data-attachment-player] video,[data-attachment-player] audio').count(),0);
  await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:30,downloadThroughput:625000,uploadThroughput:625000});
  const started = Date.now();
  await card(mp4.id).getByRole('button',{name:/Воспроизвести видео/}).click();
  const video = card(mp4.id).locator('video');
  await until(()=>video.evaluate(v=>v.currentTime>0 && v.readyState>=2),30000);
  const initialBytes=received;
  assert.ok(initialBytes>0&&initialBytes<mp4.sizeBytes,'must not wait for full original');
  const initialBuffered=await video.evaluate(v=>Array.from({length:v.buffered.length},(_,i)=>[v.buffered.start(i),v.buffered.end(i)]));
  assert.ok(initialBuffered.every(range=>range[1]<65),'seek target already buffered');
  record('MP4 first frame direct private S3',{ttffMs:Date.now()-started,byteSize:mp4.sizeBytes,initialBytes,initialBuffered,downstreamMbps:5});
  await video.evaluate(v=>v.pause());
  await shot(a,'inline');
  const seek = Date.now();
  await video.evaluate(v=>{v.currentTime=65;});
  await until(()=>video.evaluate(v=>!v.seeking && v.currentTime>=64),15000);
  record('seek to unloaded area',{seekMs:Date.now()-seek});
  await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
  await video.evaluate(v=>{v.playbackRate=1.5;v.volume=.35;v.muted=true;});
  assert.equal(await video.evaluate(v=>v.playbackRate),1.5);
  await video.evaluate(v=>v.requestFullscreen());
  assert.equal(await page.evaluate(()=>!!document.fullscreenElement),true);await page.evaluate(()=>document.exitFullscreen());
  const pip=await video.evaluate(async v=>{if(!document.pictureInPictureEnabled)return 'unsupported';await v.requestPictureInPicture();const ok=document.pictureInPictureElement===v;await document.exitPictureInPicture();return ok;});
  assert.ok(pip===true||pip==='unsupported');record('rate, volume/mute, Fullscreen and PiP',{pip});
  const handle = await video.elementHandle();
  await card(mp4.id).getByRole('button',{name:'Развернуть',exact:true}).click();
  await page.getByRole('dialog',{name:mp4.originalFileName}).waitFor();
  assert.equal(await video.evaluate((v,original)=>v===original,handle),true);
  await shot(a,'expanded'); await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('dialog',{name:mp4.originalFileName}).count(),0);
  record('expanded preserves same media element, focus and position');
  await video.evaluate(v=>{v.muted=false;return v.play();});
  await card(webm.id).getByRole('button',{name:/Воспроизвести видео/}).click();
  await until(()=>card(webm.id).locator('video').evaluate(v=>v.currentTime>0));
  assert.equal(await video.evaluate(v=>v.paused),true);
  record('WebM playback and single active attachment');
  await card(audio.id).getByRole('button',{name:/Воспроизвести аудио/}).click();
  await until(()=>card(audio.id).locator('audio').evaluate(v=>v.currentTime>0));
  await card(note.id).getByRole('button',{name:/Воспроизвести видео/}).click();
  await until(()=>card(note.id).locator('video').evaluate(v=>v.currentTime>0));
  assert.equal(await page.evaluate(()=>window.__audioContexts.length),contextsBefore);
  record('historical AUDIO and VIDEO_NOTE without new AudioContext');
  // Isolated current user, outsider, anonymous and raw storage requests use the real server.
  const denied=await page.request.post(api+`/message-attachments/${mp4.id}/playback-access`,{headers:{Authorization:'Bearer '+c.token}});
  assert.ok([403,404].includes(denied.status()));
  const descriptor=grants.find(g=>g.attachmentId===mp4.id);assert.ok(descriptor);
  const raw=new URL(descriptor.url);raw.search='';
  const anonymous=await page.request.get(raw.toString());assert.ok([403,404].includes(anonymous.status()));
  const partial=await page.request.get(descriptor.url,{headers:{Range:'bytes=1000-1999'}});
  assert.equal(partial.status(),206);assert.equal(partial.headers()['content-range'],`bytes 1000-1999/${mp4.sizeBytes}`);
  const invalid=await page.request.get(descriptor.url,{headers:{Range:`bytes=${mp4.sizeBytes+1}-`}});assert.equal(invalid.status(),416);
  record('real S3 GET Range 206,416,anonymous and outsider denial');
  fs.writeFileSync(out+'/range.json',JSON.stringify(requests,null,2));
  assert.ok(requests.some(r=>r.status===206&&r.range),'actual browser Range missing');
  await assertIdentity(a);await assertIdentity(b);
  const after=await Promise.all([a,b].map(rtp));
  for(let i=0;i<2;i++){assert.ok(bytes(after[i],'outbound')>bytes(before[i],'outbound'));assert.ok(bytes(after[i],'inbound')>bytes(before[i],'inbound'));}
  record('LiveKit Room/PC/microphone identity and continuing bilateral RTP');
  await page.getByRole('button',{name:'Друзья',exact:true}).first().click();
  await page.evaluate(id=>{history.pushState(null,'','/dm?roomId='+id);window.dispatchEvent(new PopStateEvent('popstate'));},other.id);
  await until(async()=>await page.locator('[data-attachment-player] video,[data-attachment-player] audio').count()===0);
  await assertIdentity(a);record('DM change artifacts/stages/releases attachment media and preserves call identity');
  await page.getByRole('button',{name:'Открыть',exact:true}).click();
  await hangup(a,b);record('existing hangup closes PCs, microphone tracks and call AudioContexts');
};

if(require.main===module){
 const path=require('node:path'),Module=require('node:module');
 const file=path.resolve('scripts/ui-call-stage-acceptance.cjs');
 let source=fs.readFileSync(file,'utf8');
 source=source.replace("if (process.argv.includes('--settings')) {",`if (true) {
   await require('./media-stage5a-acceptance.cjs').run({a,b,c,dm,other,group,out,record,until,http,shot,saveIdentity,assertIdentity,hangup,rtp,bytes});return;
 }\nif (process.argv.includes('--settings')) {`);
 source=source.replaceAll('m.text().replace(',"m.text().replace(/https?:\\/\\/[^\\s]+/g,'[URL]').replace(");
 if(process.argv.includes('--electron')) source=source.replace('const browser = await chromium.launch({','const browser = await require("./media-stage5a-electron.cjs").launch({');
 process.env.UI_STAGE_BASE||='http://localhost:3001';process.env.UI_STAGE_EVIDENCE||='artifacts/stages/media-stage5a-evidence/browser';
 const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(source,file);
}
