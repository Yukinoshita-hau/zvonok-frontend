const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {chromium}=require(process.env.STAGE10_PLAYWRIGHT||'C:/Users/Пользователь/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base=process.env.STAGE5E_BASE||'http://localhost:13000',api=base+'/api',out=path.resolve('media-stage5e-evidence');
const stateFile=path.join(os.tmpdir(),'zvonok-stage5e-runtime.json');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
fs.mkdirSync(out,{recursive:true});
async function request(user,url,method='GET',body){const r=await fetch(api+url,{method,headers:{...(user?{Authorization:'Bearer '+user.accessToken}:{}),...(body&&!(body instanceof FormData)?{'Content-Type':'application/json'}:{})},body:body?(body instanceof FormData?body:JSON.stringify(body)):undefined});assert.ok(r.ok,url+' HTTP '+r.status);return r.json();}
async function user(){const name='s5e'+crypto.randomBytes(6).toString('hex'),password=crypto.randomUUID()+'aA1!';const result=await request(null,'/auth/register','POST',{username:name,email:name+'@test.invalid',password});return {name,password,...result};}
async function upload(owner,room,file,name,mime){const form=new FormData();form.set('clientRequestId',crypto.randomUUID());form.set('files',new Blob([fs.readFileSync(file)],{type:mime}),name);return request(owner,`/rooms/${room.id}/messages/attachments`,'POST',form);}
async function loginPage(page,user){
 await page.addInitScript(()=>{window.__stage5eSockets=[];window.__stage5eConnected=false;const Original=window.WebSocket;window.WebSocket=class extends Original{constructor(...args){super(...args);window.__stage5eSockets.push(this);this.addEventListener('message',event=>{if(String(event.data).startsWith('CONNECTED'))window.__stage5eConnected=true;});}};});
 await page.goto(base+'/auth/login');await page.locator('[name=usernameOrEmail]').fill(user.name);await page.locator('[name=password]').fill(user.password);await page.locator('form button').click();await page.getByRole('button',{name:'Друзья',exact:true}).first().waitFor();await page.waitForFunction(()=>window.__stage5eConnected);
}
async function send(page,destination){await page.evaluate(destination=>{const ws=window.__stage5eSockets.findLast(s=>s.readyState===1);if(!ws)throw Error('No real app WebSocket');ws.send('SEND\ndestination:'+destination+'\ncontent-type:application/json\ncontent-length:0\n\n\0');},destination);}
async function until(fn){const end=Date.now()+30000;while(Date.now()<end){const value=await fn();if(value)return value;await new Promise(resolve=>setTimeout(resolve,100));}throw Error('Application event timeout');}
(async()=>{
 const results={status:'FAIL',transport:'real Chrome -> Caddy -> backend/RustFS'},errors=[],network=[];let browser,page;
 try{
  if(process.argv.includes('--verify')){
   const s=JSON.parse(fs.readFileSync(stateFile));await request(null,'/auth/login','POST',{usernameOrEmail:s.owner.name,password:s.owner.password});
   const message=await request(s.owner,`/rooms/${s.room.id}/messages/${s.message.id}`);assert.equal(message.attachments[0].id,s.message.attachments[0].id);
   const grant=await request(s.owner,`/message-attachments/${message.attachments[0].id}/download-access`,'POST');const r=await fetch(grant.url);assert.equal(r.status,200);assert.equal(sha(Buffer.from(await r.arrayBuffer())),s.sha256);
   const anonymous=await fetch(new URL(grant.url).origin+new URL(grant.url).pathname);assert.equal(anonymous.status,403);
   const cors=await fetch(grant.url,{headers:{Origin:'http://denied.invalid',Range:'bytes=0-0'}});assert.notEqual(cors.headers.get('access-control-allow-origin'),'*');assert.notEqual(cors.headers.get('access-control-allow-origin'),'http://denied.invalid');
   const scoped=new URL(grant.url);scoped.pathname+='.outside-grant';assert.equal((await fetch(scoped)).status,403);
   const library=await request(s.owner,`/rooms/${s.room.id}/attachments?category=all&limit=60`);
   assert.ok(!JSON.stringify(library).includes('"storageKey"'));
   const originals=[];
   for(const [name,file] of [['stage5e-pages-100.pdf','media-stage5b-evidence/fixtures/pages-100.pdf'],['stage5e-image.png','media-stage5b-evidence/fixtures/landscape.png']]){
    const item=library.items.find(x=>x.attachment.originalFileName===name);assert.ok(item,name);
    const access=await request(s.owner,`/message-attachments/${item.attachment.id}/download-access`,'POST');const response=await fetch(access.url);assert.equal(response.status,200);const actual=sha(Buffer.from(await response.arrayBuffer()));assert.equal(actual,sha(fs.readFileSync(file)));originals.push({name,sha256:actual});
   }
   fs.writeFileSync(out+'/'+(process.env.STAGE5E_VERIFY_NAME||'persistence')+'.json',JSON.stringify({status:'PASS',registrationLogin:'PASS',message:'PASS',originalSha256:s.sha256,otherOriginals:originals,anonymousGet:'DENIED',wrongOriginCors:'DENIED',objectScopedSignature:'PASS',libraryStorageKeysAbsent:true},null,2));return;
  }
  const previous=process.argv.includes('--resume')?JSON.parse(fs.readFileSync(stateFile)):null;
  const owner=previous?.owner||await user(),peer=previous?.peer||await user(),outsider=previous?.outsider||await user();results.registration='PASS';
  await request(null,'/auth/login','POST',{usernameOrEmail:owner.name,password:owner.password});results.login='PASS';
  browser=await chromium.launch({channel:'chrome',headless:true});page=await browser.newPage({viewport:{width:1366,height:900},acceptDownloads:true});page.setDefaultTimeout(60000);
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(new URL(r.url()).port==='19020')network.push({path:new URL(r.url()).pathname,status:r.status(),range:r.request().headers().range||null});});
  await loginPage(page,owner);
  const handshake=await page.evaluate(()=>window.__stage5eSockets.filter(s=>s.url.includes('/api/ws-raw')).map(s=>({query:new URL(s.url).search,protocol:s.protocol})));
  assert.ok(handshake.length);assert.ok(handshake.every(s=>s.query===''&&s.protocol==='v12.stomp'));results.stompHeaderAuth='PASS';
  let dm=previous?.dm;
  if(!previous){const peerContext=await browser.newContext(),peerPage=await peerContext.newPage();await loginPage(peerPage,peer);
  await send(page,'/app/friend/send/'+peer.name);const invitation=await until(async()=> (await request(peer,'/friends/requests/incoming')).find(r=>r.senderUsername===owner.name));await send(peerPage,'/app/friend/accept/'+invitation.requestId);
  dm=await until(async()=> (await request(owner,'/rooms/all')).find(r=>r.type==='PRIVATE'&&r.members.some(m=>m.username===peer.name)));await peerContext.close();}results.dmAndStomp='PASS';
  const room=previous?.room||await request(owner,'/rooms/createGroup','POST',{roomName:'Stage5E clean install',roomMemberUsernames:[peer.name]});const state={owner,peer,outsider,room,dm};
  await page.goto(base+'/dm?roomId='+room.id);const composer=()=>page.getByRole('textbox',{name:'Сообщение',exact:true});await composer().waitFor();await composer().fill('Stage5E plain message');await page.getByRole('button',{name:'Отправить сообщение',exact:true}).click();await page.getByText('Stage5E plain message',{exact:true}).last().waitFor();results.message='PASS';
  const file=path.resolve('media-stage5a-evidence/progressive.mp4'),original=fs.readFileSync(file);assert.equal(original.length,25545779);
  let message=previous?.message;if(!message){await page.locator('input[type=file]').setInputFiles(file);await page.getByRole('button',{name:'Удалить вложение',exact:true}).waitFor();
  const uploaded=page.waitForResponse(r=>r.url().endsWith(`/rooms/${room.id}/messages/attachments`)&&r.request().method()==='POST',{timeout:300000});await page.getByRole('button',{name:'Отправить сообщение',exact:true}).click();const response=await uploaded;assert.equal(response.status(),200);message=await response.json();}results.mp4Bytes=message.attachments[0].sizeBytes;assert.equal(results.mp4Bytes,25545779);
  state.message=message;state.sha256=sha(original);fs.writeFileSync(stateFile,JSON.stringify(state));
  const id=message.attachments[0].id;if(!process.argv.includes('--finish')){const grant=await request(owner,`/message-attachments/${id}/playback-access`,'POST');assert.equal(new URL(grant.url).origin,'http://localhost:19020');assert.ok(!grant.url.includes('eyJ'));assert.equal(new URL(grant.url).searchParams.get('X-Amz-Credential')?.split('/')[0].length>0,true);
  let r=await fetch(grant.url,{headers:{Range:'bytes=20000000-20001023',Origin:base}});assert.equal(r.status,206);assert.equal(r.headers.get('access-control-allow-origin'),base);assert.deepEqual(Buffer.from(await r.arrayBuffer()),original.subarray(20000000,20001024));results.range206='PASS';
  r=await fetch(grant.url,{headers:{Range:'bytes=999999999-',Origin:base}});assert.equal(r.status,416);results.range416='PASS';
  r=await fetch(grant.url);assert.equal(sha(Buffer.from(await r.arrayBuffer())),state.sha256);results.sha256=state.sha256;
  for(const method of ['GET','PUT']){r=await fetch(new URL(grant.url).origin+new URL(grant.url).pathname,{method,body:method==='PUT'?'forbidden':undefined});assert.ok([403,405].includes(r.status));}
  assert.equal((await fetch('http://localhost:19020/zvonok-data')).status,404);
  assert.equal((await fetch('http://localhost:19020/rustfs/admin/v3/list-users')).status,404);
  r=await fetch(api+`/message-attachments/${id}/playback-access`,{method:'POST',headers:{Authorization:'Bearer '+outsider.accessToken}});assert.equal(r.status,404);results.privateStorageAndOutsider='PASS';
  await page.getByRole('button',{name:/Воспроизвести видео/}).click();await page.waitForFunction(()=>document.querySelector('video')?.currentTime>0);await page.locator('video').evaluate(v=>{v.currentTime=65;});await page.waitForFunction(()=>{const v=document.querySelector('video');return v?.currentTime>=65&&!v.seeking&&v.readyState>=2});await page.screenshot({path:out+'/video.png'});await page.locator('video').evaluate(v=>v.pause());results.videoFirstFrameAndSeek='PASS';}
  const existing=await request(owner,`/rooms/${room.id}/attachments?category=all&limit=60`);if(!existing.items.some(x=>x.attachment.originalFileName==='stage5e-pages-100.pdf'))await upload(owner,room,'media-stage5b-evidence/fixtures/pages-100.pdf','stage5e-pages-100.pdf','application/pdf');if(!existing.items.some(x=>x.attachment.originalFileName==='stage5e-image.png'))await upload(owner,room,'media-stage5b-evidence/fixtures/landscape.png','stage5e-image.png','image/png');
  await page.getByRole('button',{name:'Медиа и файлы',exact:true}).click();const library=()=>page.getByRole('dialog',{name:'Медиа и файлы',exact:true});await library().getByRole('textbox',{name:'Поиск по имени файла'}).fill('stage5e-image');await library().getByRole('button',{name:'Открыть stage5e-image.png',exact:true}).click();await page.getByRole('dialog').filter({has:page.locator('button',{hasText:'Скачать оригинал'})}).locator('img').evaluate(image=>image.decode());await page.keyboard.press('Escape');results.image='PASS';await library().getByRole('button',{name:'Файлы',exact:true}).click();await library().getByRole('textbox',{name:'Поиск по имени файла'}).fill('stage5e-pages');await library().getByRole('button',{name:'Открыть stage5e-pages-100.pdf',exact:true}).click();
  const viewer=page.getByRole('dialog').filter({has:page.locator('button',{hasText:'Скачать оригинал'})});await viewer.locator('canvas').waitFor();await page.waitForFunction(()=>document.querySelector('.textLayer')?.textContent.includes('Zvonok'));await page.screenshot({path:out+'/pdf.png'});results.pdfJs='PASS';
  await page.keyboard.press('Escape');await library().getByRole('button',{name:/^Перейти к сообщению:/}).first().click();await library().waitFor({state:'hidden'});await page.locator('[class*=message-row-highlighted]').waitFor();results.librarySearchAndJump='PASS';
  const revoke=await fetch(api+`/rooms/${room.id}/leave`,{method:'POST',headers:{Authorization:'Bearer '+peer.accessToken}});assert.equal(revoke.status,204);
  const denied=await fetch(api+`/message-attachments/${id}/playback-access`,{method:'POST',headers:{Authorization:'Bearer '+peer.accessToken}});assert.equal(denied.status,404);results.removedGroupMember='PASS';
  assert.deepEqual(errors,[]);results.status='PASS';
 }catch(error){results.error=error.message.replace(/https?:\/\/\S+/g,'[URL]');process.exitCode=1;await page?.screenshot({path:out+'/failure.png'}).catch(()=>{});}
 finally{if(!process.argv.includes('--verify')){fs.writeFileSync(out+'/browser.json',JSON.stringify({...results,errors,storageRequests:network},null,2));console.log(results);}await browser?.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
