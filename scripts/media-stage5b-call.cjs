const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
exports.run=async({a,b,c,dm,other,group,out,record,until,http,shot,saveIdentity,assertIdentity,hangup,rtp,bytes,stage,unmuteStage,ready,connected})=>{
 const page=a.page,api=process.env.UI_STAGE_API||'http://localhost:3001/api';
 const callShot=async name=>{if(!process.argv.includes('--electron'))await shot(a,name);};
 const navigate=async room=>{await page.evaluate(id=>{history.pushState(null,'','/dm?roomId='+id);window.dispatchEvent(new PopStateEvent('popstate'));},room.id);await page.getByRole('textbox',{name:'Сообщение',exact:true}).waitFor();};
 const upload=async(room,file,mime,type)=>{const r=await page.request.post(api+`/rooms/${room.id}/messages/attachments`,{headers:{Authorization:'Bearer '+a.token},multipart:{clientRequestId:crypto.randomUUID(),...(type?{attachmentType:type}:{}),files:{name:file.split('/').pop(),mimeType:mime,buffer:fs.readFileSync(file)}}});assert.equal(r.status(),200);const dto=await r.json();fs.writeFileSync(out+'/last-upload.json',JSON.stringify(dto,null,2));return dto.attachments[0];};
 const check=async(room,label,peers)=>{
  for(const peer of peers)await saveIdentity(peer);
  const ownerIdentity=async(save)=>page.evaluate(save=>{const root=document.getElementById('root'),key=Object.keys(root).find(k=>k.startsWith('__reactContainer$')),fiber=root[key],stack=[fiber.stateNode?.current||fiber],owners=new Set();while(stack.length){const n=stack.pop(),value=n.memoizedProps?.value;if(typeof value?.setEnabled==='function'&&typeof value.mediaGeneration==='number')owners.add(value);if(n.child)stack.push(n.child);if(n.sibling)stack.push(n.sibling);}if(save)window.__stage5bOwner=[...owners][0];return owners.size===1&&owners.has(window.__stage5bOwner);},save);
  assert.ok(await ownerIdentity(true));
  const before=await Promise.all(peers.map(rtp));
  await page.getByRole('button',{name:'Свернуть звонок',exact:true}).first().click();
  for(const peer of peers.slice(1))await peer.page.getByRole('button',{name:'Свернуть звонок',exact:true}).first().click();
  await navigate(room);
  const fixtures=[['artifacts/stages/media-stage5b-evidence/fixtures/pages-100.pdf','application/pdf'],['artifacts/stages/media-stage5b-evidence/fixtures/preview.txt','text/plain']];
  for(const [file,mime] of fixtures){const attachment=await upload(room,file,mime);await until(()=>b.page.evaluate(id=>Object.values(window.__callStore.getState().message.live).concat(window.__callStore.getState().message.messages).some(message=>message.attachments?.some(a=>a.id===id)),attachment.id));const trigger=page.getByRole('button').filter({has:page.locator('span',{hasText:attachment.originalFileName})}).last();await trigger.click();const modal=page.getByRole('dialog');if(mime==='application/pdf')await modal.locator('.textLayer').waitFor();else await modal.locator('pre').waitFor();await callShot(label+'-'+attachment.originalFileName);await page.keyboard.press('Escape');await assertIdentity(a);}
  const image=await upload(room,'artifacts/stages/media-stage5b-evidence/fixtures/landscape.png','image/png');
  await page.getByRole('button').filter({has:page.locator('span',{hasText:image.originalFileName})}).last().click();await page.waitForFunction(()=>document.querySelector('[role=dialog] img')?.naturalWidth>0);await callShot(label+'-image');await page.keyboard.press('Escape');
  for(const [file,mime,type] of [['artifacts/stages/media-stage5b-evidence/fixtures/sample.mp4','video/mp4','VIDEO'],['artifacts/stages/media-stage5a-evidence/ordinary.mp3','audio/mpeg','AUDIO'],['artifacts/stages/media-stage5a-evidence/clip.webm','video/webm','VIDEO_NOTE']]){
   const attachment=await upload(room,file,mime,type),card=page.locator(`[data-attachment-player="${attachment.id}"]`);await card.getByRole('button',{name:/Воспроизвести/}).click();await until(()=>card.locator('video,audio').evaluate(el=>el.currentTime>0));await callShot(label+'-'+type);await assertIdentity(a);
  }
  await navigate(other);await assertIdentity(a);await navigate(room);await assertIdentity(a);
  const after=await Promise.all(peers.map(rtp));for(let i=0;i<peers.length;i++){await assertIdentity(peers[i]);assert.ok(bytes(after[i],'outbound')>bytes(before[i],'outbound'));assert.ok(bytes(after[i],'inbound')>bytes(before[i],'inbound'));}
  assert.ok(await ownerIdentity(false));record(label+' viewers, FILE STOMP recipient, historical AUDIO/VIDEO_NOTE, Stage 5A video, same Room/PC/generation/MicrophoneCaptureOwner/capture and growing RTP');
  await page.getByRole('button',{name:'Открыть',exact:true}).click();
 };
 await check(dm,'DM',[a,b]);await hangup(a,b);record('DM viewer regression hangup cleanup');
 for(const peer of [a,b,c]){await peer.page.goto(process.env.UI_STAGE_BASE+'/dm?roomId='+group.id);await ready(peer);}
 await page.getByRole('button',{name:'Начать звонок',exact:true}).click();for(const peer of [b,c])await peer.page.getByRole('button',{name:'Принять',exact:true}).click();for(const peer of [a,b,c]){await stage(peer);await unmuteStage(peer);}await connected([a,b,c]);
 await check(group,'GROUP',[a,b,c]);await hangup(a,b);await until(()=>c.page.evaluate(()=>window.__callStore.getState().call.callId===null));record('GROUP viewer regression hangup cleanup');
};
if(require.main===module){
 const path=require('node:path'),Module=require('node:module'),file=path.resolve('scripts/ui-call-stage-acceptance.cjs');let source=fs.readFileSync(file,'utf8');
 source=source.replace('participants.push(u);',`participants.push(u);page.on('response',response=>{if(response.status()>=500)errors.push({user:name,type:'http-response',status:response.status(),path:new URL(response.url()).pathname});});`);
 source=source.replace("if (process.argv.includes('--settings')) {",`if (true) { await require('./media-stage5b-call.cjs').run({a,b,c,dm,other,group,out,record,until,http,shot,saveIdentity,assertIdentity,hangup,rtp,bytes,stage,unmuteStage,ready,connected});return; }\nif (process.argv.includes('--settings')) {`);
 if(process.argv.includes('--electron'))source=source.replace('const browser = await chromium.launch({','const browser = await require("./media-stage5b-electron.cjs").launch({');
 process.env.UI_STAGE_BASE='http://localhost:3001';process.env.UI_STAGE_EVIDENCE='artifacts/stages/media-stage5b-evidence/'+(process.argv.includes('--electron')?'electron-call':'browser-call');
 const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(source,file);
}


