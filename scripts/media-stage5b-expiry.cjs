const {chromium}=require('C:/Users/Пользователь/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {shortUrl}=require('./media-stage5a-storage.cjs');
(async()=>{
 const state=JSON.parse(fs.readFileSync(path.join(os.tmpdir(),'zvonok-stage5b-runtime.json'))),api='http://127.0.0.1:18081/api',headers={Authorization:'Bearer '+state.owner.accessToken};
 const roomResponse=await fetch(api+'/rooms/createGroup',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({roomName:'Stage 5B expiry only',roomMemberUsernames:[]})});assert.equal(roomResponse.status,201);const room=await roomResponse.json();
 const form=new FormData();form.set('clientRequestId',crypto.randomUUID());form.set('files',new Blob([fs.readFileSync('artifacts/stages/media-stage5b-evidence/fixtures/pages-500.pdf')],{type:'application/pdf'}),'expiry.pdf');
 const uploaded=await fetch(api+`/rooms/${room.id}/messages/attachments`,{method:'POST',headers,body:form});assert.equal(uploaded.status,200);const attachment=(await uploaded.json()).attachments[0];
 const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage();page.setDefaultTimeout(60000);const results=[];let grants=0,short,phase='login';
 try{
 await page.route(`**/message-attachments/${attachment.id}/playback-access`,async route=>{grants++;const response=await route.fetch();if(grants===1&&response.ok()){const descriptor=await response.json();short=shortUrl(descriptor.url,'GET',3);await route.fulfill({response,json:{...descriptor,url:short,expiresAt:new Date(Date.now()+3000).toISOString()}});}else await route.fulfill({response});});
 await page.goto('http://localhost:3001/auth/login');await page.locator('[name=usernameOrEmail]').fill(state.owner.name);await page.locator('[name=password]').fill(state.owner.password);await page.locator('form button').click();await page.getByRole('button',{name:'Друзья',exact:true}).first().waitFor();await page.goto('http://localhost:3001/dm?roomId='+room.id);
 phase='initial PDF';await page.getByRole('button').filter({has:page.locator('span',{hasText:'expiry.pdf'})}).click();await page.waitForFunction(()=>document.querySelector('.textLayer')?.textContent.includes('Zvonok'));
 await page.waitForTimeout(4000);assert.equal((await fetch(short,{headers:{Range:'bytes=100-199'}})).status,403);
 phase='expired navigation';await page.getByRole('spinbutton',{name:'Страница PDF'}).fill('250');
 await page.waitForFunction(()=>document.querySelector('.textLayer')?.textContent.includes('page 250 of 500'),{timeout:60000});assert.ok(grants>=2);results.push({status:'PASS',scenario:'real expired S3 signature 403, automatic regrant and page 250 restored',grants});
 await page.keyboard.press('Escape');
 const leave=await fetch(api+`/rooms/${room.id}/leave`,{method:'POST',headers});assert.equal(leave.status,204);
 // Leaving the room removes its chat from the UI; a fresh grant still must deny access.
 const denied=await fetch(api+`/message-attachments/${attachment.id}/playback-access`,{method:'POST',headers});assert.ok([403,404].includes(denied.status));results.push({status:'PASS',scenario:'backend regrant denied after leaving GROUP',statusCode:denied.status});
 }catch(e){results.push({status:'FAIL',phase,grants,error:e.message.replace(/https?:\/\/[^\s]+/g,'[URL]')});await page.screenshot({path:'artifacts/stages/media-stage5b-evidence/expiry-failure.png'}).catch(()=>{});process.exitCode=1;}
 finally{fs.writeFileSync('artifacts/stages/media-stage5b-evidence/expiry.json',JSON.stringify({results},null,2));await browser.close();console.log(results);}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
