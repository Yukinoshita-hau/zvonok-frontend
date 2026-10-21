const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
exports.run=async({a,b,dm,group,record,until,http,shot,saveIdentity,assertIdentity,hangup,rtp,bytes})=>{
 const page=a.page,api=process.env.UI_STAGE_API||'http://localhost:3001/api';
 const upload=async(room,name,file,mime)=>{const form=new FormData();form.set('clientRequestId',crypto.randomUUID());form.set('files',new Blob([fs.readFileSync(file)],{type:mime}),name);const r=await fetch(api+`/rooms/${room.id}/messages/attachments`,{method:'POST',headers:{Authorization:'Bearer '+a.token},body:form});assert.equal(r.status,200);return r.json();};
 for(const peer of [a,b])await saveIdentity(peer);const before=await Promise.all([a,b].map(rtp));
 await page.getByRole('button',{name:'Чат',exact:true}).click();await page.getByRole('button',{name:'Медиа и файлы',exact:true}).click();
 const lib=()=>page.getByRole('dialog',{name:'Медиа и файлы',exact:true});
 await lib().getByRole('button',{name:'Все',exact:true}).click();await lib().getByText('Файлы не найдены',{exact:true}).waitFor();
 const pdf=await upload(dm,'stage5c-call.pdf','artifacts/stages/media-stage5b-evidence/fixtures/pages-100.pdf','application/pdf');
 await lib().getByRole('button',{name:'Открыть stage5c-call.pdf',exact:true}).waitFor();record('real DM FILE STOMP invalidates open library');
 for(const [name,file,mime] of [['stage5c-image.png','artifacts/stages/media-stage5b-evidence/fixtures/landscape.png','image/png'],['stage5c-video.mp4','artifacts/stages/media-stage5b-evidence/fixtures/sample.mp4','video/mp4']])await upload(dm,name,file,mime);
 for(const [name,selector] of [['stage5c-image.png','img'],['stage5c-call.pdf','canvas'],['stage5c-video.mp4','video']]){
  await lib().getByRole('button',{name:'Открыть '+name,exact:true}).click();const viewer=page.getByRole('dialog').filter({has:page.locator('button',{hasText:'Скачать оригинал'})});
  if(selector==='video')await viewer.getByRole('button',{name:/Воспроизвести/}).click();await viewer.locator(selector).waitFor();
  if(selector==='canvas')await page.waitForFunction(()=>document.querySelector('.textLayer')?.textContent.includes('Zvonok'));
  if(selector==='img')await page.waitForFunction(()=>document.querySelector('[role=dialog] img')?.naturalWidth>0);
  if(selector==='video')await page.waitForFunction(()=>document.querySelector('[role=dialog] video')?.currentTime>0);
  await shot(a,'active-call-'+selector);await page.keyboard.press('Escape');await assertIdentity(a);
 }
 await shot(a,'active-call-library');await http(a,`/messages/${pdf.id}`,'DELETE');await lib().getByRole('button',{name:'Открыть stage5c-call.pdf',exact:true}).waitFor({state:'hidden'});
 for(const url of [`/rooms/${dm.id}/messages/${pdf.id}/context`,`/message-attachments/${pdf.attachments[0].id}/download-access`]){const r=await page.request.fetch(api+url,{method:url.endsWith('access')?'POST':'GET',headers:{Authorization:'Bearer '+a.token}});assert.equal(r.status(),404);}
 record('real delete STOMP removes item, deleted metadata and originals denied');
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'Свернуть звонок',exact:true}).first().click();
 await page.evaluate(id=>{history.pushState(null,'','/dm?roomId='+id);window.dispatchEvent(new PopStateEvent('popstate'));},group.id);await page.getByRole('textbox',{name:'Сообщение',exact:true}).waitFor();
 await upload(group,'stage5c-group.pdf','artifacts/stages/media-stage5b-evidence/fixtures/pages-1.pdf','application/pdf');await page.getByRole('button',{name:'Медиа и файлы',exact:true}).click();await lib().getByRole('button',{name:'Файлы',exact:true}).click();await lib().getByRole('button',{name:'Открыть stage5c-group.pdf',exact:true}).waitFor();await shot(a,'group-during-dm-call');await page.keyboard.press('Escape');await assertIdentity(a);
 const after=await Promise.all([a,b].map(rtp));for(let i=0;i<2;i++){await assertIdentity([a,b][i]);assert.ok(bytes(after[i],'outbound')>bytes(before[i],'outbound'));assert.ok(bytes(after[i],'inbound')>bytes(before[i],'inbound'));}
 record('same Room, RTCPeerConnection, generation, ownership, captures and increasing inbound/outbound RTP across library/viewers/GROUP');
 await page.getByRole('button',{name:'Открыть',exact:true}).click();await hangup(a,b);record('return to call and hangup cleanup');
};
if(require.main===module){const path=require('node:path'),Module=require('node:module'),file=path.resolve('scripts/ui-call-stage-acceptance.cjs');let source=fs.readFileSync(file,'utf8');source=source.replace("if (process.argv.includes('--settings')) {",`if (true) { await require('./media-stage5c-call.cjs').run({a,b,c,dm,group,out,record,until,http,shot,saveIdentity,assertIdentity,hangup,rtp,bytes});return; }\nif (process.argv.includes('--settings')) {`);process.env.UI_STAGE_BASE='http://localhost:3001';process.env.UI_STAGE_EVIDENCE='artifacts/stages/media-stage5c-evidence/call';const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(source,file);}
