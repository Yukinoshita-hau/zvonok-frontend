// Uses the already bundled Playwright; no new dependency or production endpoint.
const { chromium } = require(process.env.STAGE10_PLAYWRIGHT || 'C:/Users/Пользователь/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const BASE='http://localhost:3000', API='http://localhost:8080/api';
const out='artifacts/stages/livekit-local-evidence'; fs.mkdirSync(out,{recursive:true});
 const results=[], errors=[], serverUrls=[];
const participants=[];
const record=(scenario,details={})=>{results.push({scenario,status:'PASS',...details}); console.log('PASS',scenario);};
async function until(fn,timeout=15000) { const end=Date.now()+timeout; let last; while(Date.now()<end) { try {const x=await fn();if(x)return x;}catch(e){last=e;} await new Promise(r=>setTimeout(r,100)); } throw last || Error('condition timeout'); }
async function http(u,path,method='GET',body) { const r=await u.page.request.fetch(API+path,{method,headers:{Authorization:`Bearer ${u.token}`},data:body}); if(!r.ok())throw Error(`${method} ${path.split('?')[0]}: ${r.status()}`);return r.status()===204?null:r.json(); }
async function send(u,dest,payload) { await u.page.evaluate(({dest,payload})=>{ const ws=window.__sockets.findLast(s=>s.readyState===1); if(!ws)throw Error('no app WebSocket');const body=payload===undefined?'':JSON.stringify(payload);ws.send(`SEND\ndestination:${dest}\ncontent-type:application/json\ncontent-length:${new TextEncoder().encode(body).length}\n\n${body}\0`); },{dest,payload}); }
async function ready(u) { await u.page.waitForFunction(()=>window.__frames.some(f=>f.startsWith('CONNECTED'))); }
async function login(browser,name) {
 const context=await browser.newContext({permissions:['microphone','camera'],viewport:{width:1440,height:1000}}),page=await context.newPage();
 const u={context,page,name};
 participants.push(u);
 await page.addInitScript(()=>{
  window.__sockets=[];window.__frames=[];window.__pcs=[];window.__mediaTracks=[];window.__audioContexts=[];
  const Original=window.WebSocket; window.WebSocket=class extends Original {constructor(...a){super(...a);window.__sockets.push(this);this.addEventListener('message',e=>window.__frames.push(String(e.data)));}};
  const PC=window.RTCPeerConnection;window.RTCPeerConnection=class extends PC {constructor(...a){super(...a);window.__pcs.push(this);}};
  const gum=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=async(...a)=>{const stream=await gum(...a);window.__mediaTracks.push(...stream.getTracks());return stream;};
  const AC=window.AudioContext;window.AudioContext=class extends AC {constructor(...a){super(...a);window.__audioContexts.push(this);}};
 });
 page.on('response',async r=>{if(r.url().startsWith(API+'/calls/')&&r.ok()){try{const d=await r.json();if(d.serverUrl)serverUrls.push(d.serverUrl);}catch{}}});
 page.on('pageerror',e=>errors.push({user:name,type:'pageerror',message:e.message.replace(/eyJ[\w.-]+/g,'[JWT]')}));
 page.on('console',m=>{if(m.type()==='error')errors.push({user:name,type:'console',message:m.text().replace(/eyJ[\w.-]+/g,'[JWT]')});});
 await page.goto(BASE+'/auth/login');
 await page.locator('[name=usernameOrEmail]').fill(name);await page.locator('[name=password]').fill(process.env.LOCAL_CALL_TEST_PASSWORD);
 const response=page.waitForResponse(r=>r.url()===API+'/auth/login');await page.locator('form button').click();const r=await response;assert.equal(r.status(),200);u.token=(await r.json()).accessToken;
 await ready(u);u.me=await http(u,'/users/my');u.name=u.me.username;return u;
}
async function rtp(u) { return u.page.evaluate(async()=> {
 const result=[];
 for(const pc of window.__pcs) {
  const rows=[...(await pc.getStats()).values()];
  result.push({state:pc.connectionState,ice:pc.iceConnectionState,gathering:pc.iceGatheringState,
   outbound:rows.filter(r=>r.type==='outbound-rtp').map(r=>({kind:r.kind,bytes:r.bytesSent})),
   inbound:rows.filter(r=>r.type==='inbound-rtp').map(r=>({kind:r.kind,bytes:r.bytesReceived,frames:r.framesDecoded})),
   pairs:rows.filter(r=>r.type==='candidate-pair'&&r.nominated&&r.state==='succeeded').map(r=>({state:r.state,local:rows.filter(c=>c.id===r.localCandidateId).map(c=>({address:c.address,port:c.port,protocol:c.protocol,type:c.candidateType})),remote:rows.filter(c=>c.id===r.remoteCandidateId).map(c=>({address:c.address,port:c.port,protocol:c.protocol,type:c.candidateType}))}))});
 } return result;
 }); }
const bytes=(s,d)=>s.flatMap(p=>p[d]).filter(r=>r.kind==='audio').reduce((n,r)=>n+r.bytes,0);
async function connected(users) {
 for(const u of users) await until(async()=>{const s=await rtp(u);return bytes(s,'inbound')>0&&bytes(s,'outbound')>0;},45000);
 const before=await Promise.all(users.map(rtp));await new Promise(r=>setTimeout(r,2500));const after=await Promise.all(users.map(rtp));
 for(let i=0;i<users.length;i++){assert.ok(bytes(after[i],'inbound')>bytes(before[i],'inbound'));assert.ok(bytes(after[i],'outbound')>bytes(before[i],'outbound'));assert.ok(after[i].some(p=>p.ice==='connected'||p.ice==='completed'));}
 for(const u of users) await until(async()=>!(await u.page.getByRole('status').filter({hasText:'Восстанавливаем соединение'}).isVisible()));
 return {before,after};
}
async function hangup(a,b) {
 await a.page.getByTitle('Завершить звонок',{exact:true}).click();
 for(const u of [a,b]) await until(()=>u.page.evaluate(()=>window.__pcs.every(p=>p.connectionState==='closed')&&window.__mediaTracks.every(t=>t.readyState==='ended')&&window.__audioContexts.every(c=>c.state==='closed')),15000);
}
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required']});
 let current='login', a,b;
 try {
 a=await login(browser,process.env.LOCAL_CALL_TEST_A);b=await login(browser,process.env.LOCAL_CALL_TEST_B);record(current,{contexts:2,synthetic:true});
 const ar=await http(a,'/rooms/all'),br=await http(b,'/rooms/all');
 let dm=ar.find(r=>r.type==='PRIVATE'&&br.some(s=>s.id===r.id));
 if(!dm){await send(a,'/app/friend/send/'+b.name);const req=await until(async()=>(await http(b,'/friends/requests/incoming')).find(r=>r.senderUsername===a.name));await send(b,'/app/friend/accept/'+req.requestId);dm=await until(async()=>(await http(a,'/rooms/all')).find(r=>r.type==='PRIVATE'&&r.members.some(m=>m.username===b.name)));}
 assert.ok(dm);record('common DM',{roomId:dm.id});
 for(const u of [a,b]) {await u.page.goto(BASE+'/dm?roomId='+dm.id);await ready(u);}
 current='DM accept ICE and bidirectional RTP';
 const dial=async()=>{await a.page.locator('button').filter({has:a.page.locator('svg.lucide-phone')}).first().click();await b.page.locator('button[class*="accept-button"]').click();for(const u of [a,b])await u.page.getByRole('button',{name:'Микрофон: выключен',exact:true}).click();};
 await dial();record(current,await connected([a,b]));
 current='camera remote decoded video';await a.page.getByTitle('Камера выключена',{exact:true}).click();await until(async()=>(await rtp(b)).some(p=>p.inbound.some(r=>r.kind==='video'&&r.frames>0)),30000);record(current,{stats:await rtp(b)});await a.page.getByTitle('Камера включена',{exact:true}).click();
 current='STOMP reconnect preserves RTP';const count=await a.page.evaluate(()=>window.__pcs.length);await a.page.evaluate(()=>window.__sockets.filter(s=>s.readyState===1&&s.url.includes(':8080/')).forEach(s=>s.close()));await until(()=>a.page.evaluate(()=>window.__sockets.some(s=>s.readyState===1&&s.url.includes(':8080/'))),20000);record(current,await connected([a,b]));assert.equal(await a.page.evaluate(()=>window.__pcs.length),count);
 current='media signaling reconnect';await b.page.evaluate(()=>window.__sockets.filter(s=>s.readyState===1&&s.url.includes(':7880/')).forEach(s=>s.close()));await until(()=>b.page.evaluate(()=>window.__sockets.some(s=>s.readyState===1&&s.url.includes(':7880/'))),30000);record(current,await connected([a,b]));
 if(process.env.LOCAL_CALL_SFU_OUTAGE==='1') {
  current='SFU pause stops RTP and resume restores it';
  const {execFileSync}=require('node:child_process');let stopped;
  try {execFileSync('docker',['pause','livekit'],{stdio:'pipe'});await new Promise(r=>setTimeout(r,3000));const first=bytes(await rtp(a),'inbound');await new Promise(r=>setTimeout(r,3000));stopped=bytes(await rtp(a),'inbound');assert.equal(first,stopped);assert.equal(await a.page.evaluate(()=>window.__sockets.filter(s=>s.readyState===1&&s.url.includes(':8080/')).length),1);}
  finally {execFileSync('docker',['unpause','livekit'],{stdio:'pipe'});}
  await until(async()=>bytes(await rtp(a),'inbound')>stopped,45000);record(current,{pausedBytes:stopped,...await connected([a,b])});
 }
 current='hangup resources';await hangup(a,b);record(current);
 current='repeat DM RTP';await dial();record(current,await connected([a,b]));await hangup(a,b);
 current='decline';await a.page.locator('button').filter({has:a.page.locator('svg.lucide-phone')}).first().click();await b.page.locator('button[class*="decline-button"]').click();await until(async()=>!(await http(a,`/rooms/${dm.id}/active-call`))?.callId);record(current);
 current='GROUP';const group=await http(a,'/rooms/createGroup','POST',{roomName:'LiveKit local connectivity '+new Date().toISOString(),roomMemberUsernames:[b.name]});for(const u of [a,b]){await u.page.goto(BASE+'/dm?roomId='+group.id);await ready(u);}await dial();record(current,{roomId:group.id,...await connected([a,b])});await b.page.getByTitle('Завершить звонок',{exact:true}).click();await a.page.getByTitle('Завершить звонок',{exact:true}).click();for(const u of [a,b])await until(()=>u.page.evaluate(()=>window.__mediaTracks.every(t=>t.readyState==='ended')&&window.__audioContexts.every(c=>c.state==='closed')),15000);record('GROUP cleanup');
 }catch(e){results.push({scenario:current,status:'FAIL',error:e.message.replace(/eyJ[\w.-]+/g,'[JWT]')});console.error('FAIL',current,e.message.split('\n')[0]);if(a)fs.writeFileSync(out+'/failure-dom.txt',await a.page.locator('body').innerText());}
 finally {fs.writeFileSync(out+'/results.json',JSON.stringify({results,errors,serverUrls},null,2));await browser.close();}
 if(results.some(r=>r.status==='FAIL'))process.exitCode=1;
})();
