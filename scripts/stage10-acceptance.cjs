// Uses the already bundled Playwright; no new dependency or production endpoint.
const { chromium } = require(process.env.STAGE10_PLAYWRIGHT || 'C:/Users/Пользователь/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const BASE='http://127.0.0.1:13000', API='http://127.0.0.1:18080/api';
const out='stage10-evidence'; fs.mkdirSync(out,{recursive:true});
 const results=[], errors=[];
const participants=[];
const record=(scenario,details={})=>{results.push({scenario,status:'PASS',...details}); console.log('PASS',scenario);};
async function until(fn,timeout=15000) { const end=Date.now()+timeout; let last; while(Date.now()<end) { try {const x=await fn();if(x)return x;}catch(e){last=e;} await new Promise(r=>setTimeout(r,100)); } throw last || Error('condition timeout'); }
async function http(u,path,method='GET',body) { const r=await u.page.request.fetch(API+path,{method,headers:{Authorization:`Bearer ${u.token}`},data:body}); if(!r.ok())throw Error(`${method} ${path.split('?')[0]}: ${r.status()}`);return r.status()===204?null:r.json(); }
async function send(u,dest,payload) { await u.page.evaluate(({dest,payload})=>{ const ws=window.__sockets.findLast(s=>s.readyState===1); if(!ws)throw Error('no app WebSocket');const body=payload===undefined?'':JSON.stringify(payload);ws.send(`SEND\ndestination:${dest}\ncontent-type:application/json\ncontent-length:${new TextEncoder().encode(body).length}\n\n${body}\0`); },{dest,payload}); }
async function ready(u) { await u.page.waitForFunction(()=>window.__frames.some(f=>f.startsWith('CONNECTED'))); }
async function register(browser,name) {
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
 page.on('pageerror',e=>errors.push({user:name,type:'pageerror',message:e.message.replace(/eyJ[\w.-]+/g,'[JWT]')}));
 page.on('console',m=>{if(m.type()==='error')errors.push({user:name,type:'console',message:m.text().replace(/eyJ[\w.-]+/g,'[JWT]')});});
 await page.goto(BASE+'/auth/register');
 await page.locator('[name=username]').fill(name); await page.locator('[name=email]').fill(name+'@test.invalid');await page.locator('[name=password]').fill('Stage10-only-pass!');
 const response=page.waitForResponse(r=>r.url()===API+'/auth/register');await page.locator('form button').click();const r=await response;assert.equal(r.status(),201);u.token=(await r.json()).accessToken;
 await ready(u);u.me=await http(u,'/users/my');return u;
}
async function visible(u,text) { await u.page.getByText(text,{exact:true}).first().waitFor({state:'visible'}); }
async function uiSend(u,text) {const input=u.page.getByPlaceholder('Message @here');await input.fill(text);await input.press('Enter');}
async function stats(u) {return u.page.evaluate(async()=>{
 const pcs=[];
 for(const pc of window.__pcs){const rows=[...((await pc.getStats()).values())];pcs.push({connectionState:pc.connectionState,iceConnectionState:pc.iceConnectionState,
 inbound:rows.filter(r=>r.type==='inbound-rtp').map(r=>({kind:r.kind,bytesReceived:r.bytesReceived,packetsReceived:r.packetsReceived,packetsLost:r.packetsLost,jitter:r.jitter,framesDecoded:r.framesDecoded,totalAudioEnergy:r.totalAudioEnergy})),
 pairs:rows.filter(r=>r.type==='candidate-pair'&&r.nominated&&r.state==='succeeded').map(r=>({state:r.state,currentRoundTripTime:r.currentRoundTripTime,local:rows.filter(c=>c.id===r.localCandidateId).map(c=>({candidateType:c.candidateType,protocol:c.protocol})),remote:rows.filter(c=>c.id===r.remoteCandidateId).map(c=>({candidateType:c.candidateType,protocol:c.protocol}))}))});}return pcs;
 });}
async function incoming(u,kind) {return until(()=>u.page.evaluate(({kind})=>window.__frames.flatMap(f=>{try{return [JSON.parse(f.slice(f.indexOf('\n\n')+2).replace(/\0$/,''))];}catch{return [];}}).filter(f=>f.type===kind).at(-1),{kind}));}
if(require.main===module)(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required']});
 let current='registration';
 try {
 const suffix=Date.now().toString(36),a=await register(browser,'s10a'+suffix),b=await register(browser,'s10b'+suffix);
 record(current,{clients:2,contexts:'separate cookie/storage',media:'synthetic'});
 current='friend request and DM creation';
 await send(a,'/app/friend/send/'+b.name);
 const request=await until(async()=> (await http(b,'/friends/requests/incoming'))[0]);
 await send(b,'/app/friend/accept/'+request.requestId);
 const rooms=await until(async()=>{const rs=await http(a,'/rooms/all');return rs.length?rs:null;});
 const dm=rooms.find(r=>r.type==='PRIVATE');assert.ok(dm);await until(async()=> (await http(b,'/rooms/all')).some(r=>r.id===dm.id));record(current,{roomId:dm.id});
 current='DM UI send bidirectional';
 for(const u of [a,b]){await u.page.goto(BASE+'/dm?roomId='+dm.id);await ready(u);await u.page.getByPlaceholder('Message @here').waitFor();}
 const textA='stage10 A '+suffix,textB='stage10 B '+suffix;
 await uiSend(a,textA);await visible(a,textA);await visible(b,textA);await uiSend(b,textB);await visible(a,textB);await visible(b,textB);
 const hist=await http(a,`/rooms/${dm.id}/messages?limit=100`);assert.equal(hist.filter(m=>m.content===textA).length,1);assert.equal(hist.filter(m=>m.content===textB).length,1);record(current,{roomId:dm.id});
 current='edit delete reply and REST history on both clients';
 const first=hist.find(m=>m.content===textA);await send(a,'/app/chat/edit/'+first.id,'edited '+suffix);await visible(b,'edited '+suffix);
 await send(b,'/app/chat/send/'+dm.id,{content:'reply '+suffix,replyToMessageId:first.id});await visible(a,'reply '+suffix);
 await send(a,'/app/chat/delete/'+first.id);await until(async()=>!(await http(b,`/rooms/${dm.id}/messages?limit=100`)).some(m=>m.id===first.id && !m.deletedAt && m.content==='edited '+suffix));record(current);
 current='offline missed message and reconnect resync';
 await b.context.setOffline(true);const second=hist.find(m=>m.content===textB);await b.page.getByPlaceholder('Message @here').fill('offline unsent');
 await send(a,'/app/chat/send/'+dm.id,{content:'missed '+suffix});await visible(a,'missed '+suffix);await b.context.setOffline(false);await visible(b,'missed '+suffix);record(current);
 current='GROUP create invite and concurrent clients';
 const group=await http(a,'/rooms/createGroup','POST',{roomName:'stage10 '+suffix,roomMemberUsernames:[b.name]});
 for(const u of [a,b]){await u.page.goto(BASE+'/dm?roomId='+group.id);await ready(u);await u.page.getByPlaceholder('Message @here').waitFor();}
 await Promise.all([uiSend(a,'group A '+suffix),uiSend(b,'group B '+suffix)]);for(const u of [a,b]){await visible(u,'group A '+suffix);await visible(u,'group B '+suffix);}record(current,{roomId:group.id});
 current='100 real STOMP messages and pagination';
 for(let i=0;i<100;i++)await send(i%2?a:b,'/app/chat/send/'+group.id,{content:`burst ${suffix} ${i}`});
 await until(async()=> (await http(a,`/rooms/${group.id}/messages?limit=100`)).filter(m=>m.content?.startsWith('burst '+suffix)).length===100,30000);
 const page1=await http(a,`/rooms/${group.id}/messages?limit=15`);const page2=await http(b,`/rooms/${group.id}/messages?limit=15&beforeMessageId=${Math.min(...page1.map(m=>m.id))}`);assert.equal(new Set([...page1,...page2].map(m=>m.id)).size,30);record(current,{sent:100});
 current='DM call invite accept and real SFU synthetic audio';
 for(const u of [a,b]){await u.page.goto(BASE+'/dm?roomId='+dm.id);await ready(u);}
 await a.page.locator('button').filter({has:a.page.locator('svg.lucide-phone')}).first().click();
 const invitation=await incoming(b,'CALL_INVITE');assert.equal(invitation.chatRoomId,dm.id);
 const acceptedAt=Date.now();await b.page.locator('button[class*="accept-button"]').click();
 // The application joins with microphone disabled; explicitly enable it as a user.
 for(const u of [a,b])await u.page.getByRole('button',{name:'Микрофон: выключен',exact:true}).click();
 const media={synthetic:true,acceptedAt:new Date(acceptedAt).toISOString(),clients:[]};
 for(const u of [a,b]){const s=await until(async()=>{const s=await stats(u);return s.some(pc=>pc.inbound.some(r=>r.kind==='audio'&&r.bytesReceived>0))?s:null;},40000);media.clients.push({user:u.name,acceptToObservedInboundAudioMs:Date.now()-acceptedAt,stats:s});}
 fs.writeFileSync(out+'/webrtc-stats.json',JSON.stringify(media,null,2));record(current,{callId:invitation.callId,media:'synthetic source, real LiveKit and WebRTC inbound bytes'});
 current='camera toggle and decoded remote video';
 await a.page.getByTitle('Камера выключена',{exact:true}).click();await until(async()=> (await stats(b)).some(pc=>pc.inbound.some(r=>r.kind==='video'&&r.framesDecoded>0)),30000);
 media.video={acceptToObservedDecodedVideoMs:Date.now()-acceptedAt,stats:await stats(b)};fs.writeFileSync(out+'/webrtc-stats.json',JSON.stringify(media,null,2));
 await a.page.getByTitle('Камера включена',{exact:true}).click();record(current);
 current='mute unmute';await a.page.getByRole('button',{name:'Микрофон: включён',exact:true}).click();await a.page.getByRole('button',{name:'Микрофон: выключен',exact:true}).waitFor();await a.page.getByRole('button',{name:'Микрофон: выключен',exact:true}).click();record(current);
 current='STOMP disconnect preserves media';
 const before=await stats(a),pcCount=await a.page.evaluate(()=>window.__pcs.length);await a.page.evaluate(()=>window.__sockets.filter(s=>s.readyState===1&&s.url.includes(':18080/')).forEach(s=>s.close()));
 await until(async()=>a.page.evaluate(()=>window.__sockets.filter(s=>s.readyState===1&&s.url.includes(':18080/')).length>0),15000);
 const after=await stats(a);assert.equal(await a.page.evaluate(()=>window.__pcs.length),pcCount);assert.ok(after.some(pc=>pc.inbound.some(r=>r.kind==='audio'&&r.bytesReceived>Math.max(0,...before.flatMap(x=>x.inbound.filter(r=>r.kind==='audio').map(r=>r.bytesReceived))))));record(current);
 current='end call and tracks release';await a.page.getByTitle('Завершить звонок',{exact:true}).click();
 await until(async()=> (await stats(a)).every(pc=>pc.connectionState==='closed'));await until(async()=> (await stats(b)).every(pc=>pc.connectionState==='closed'));
 for(const u of [a,b])await u.page.waitForFunction(()=>window.__mediaTracks.every(t=>t.readyState==='ended'));
 const resources=await Promise.all([a,b].map(u=>u.page.evaluate(()=>({tracks:window.__mediaTracks.map(t=>({kind:t.kind,state:t.readyState})),contexts:window.__audioContexts.map(c=>c.state)}))));
 fs.writeFileSync(out+'/media-resources.json',JSON.stringify(resources,null,2));
 const endedToken=await a.page.request.post(API+`/calls/${invitation.callId}/token`,{headers:{Authorization:`Bearer ${a.token}`}});assert.ok([403,409].includes(endedToken.status()));record(current,{endedTokenStatus:endedToken.status()});
 current='repeat DM call and decline';await a.page.locator('button').filter({has:a.page.locator('svg.lucide-phone')}).first().click();await b.page.locator('button[class*="decline-button"]').waitFor();await b.page.locator('button[class*="decline-button"]').click();await until(async()=> !(await http(a,`/rooms/${dm.id}/active-call`))?.callId);record(current);
 current='GROUP third member invite and duplicate join';
 const c=await register(browser,'s10c'+suffix);const invite=await http(a,`/rooms/${group.id}/invites`,'POST',{});
 assert.equal((await http(c,`/invites/${invite.inviteToken}/join`,'POST')).joined,true);
 assert.equal((await http(c,`/invites/${invite.inviteToken}/join`,'POST')).alreadyMember,true);record(current);
 current='GROUP three real SFU clients';
 for(const u of [a,b,c]){await u.page.goto(BASE+'/dm?roomId='+group.id);await ready(u);}
 await a.page.locator('button').filter({has:a.page.locator('svg.lucide-phone')}).first().click();
 const groupInvite=await incoming(b,'CALL_INVITE');for(const u of [b,c])await u.page.locator('button[class*="accept-button"]').click();
 for(const u of [a,b,c])await u.page.getByRole('button',{name:'Микрофон: выключен',exact:true}).click();
 for(const u of [a,b,c])await until(async()=> (await stats(u)).flatMap(pc=>pc.inbound).filter(r=>r.kind==='audio'&&r.bytesReceived>0).length===2,30000);
 record(current,{callId:groupInvite.callId});
 current='GROUP leave preserves call and rejoin';await b.page.getByTitle('Завершить звонок',{exact:true}).click();
 await until(async()=> (await http(a,`/rooms/${group.id}/active-call`))?.participantsCount===2);
 await b.page.getByRole('button',{name:'Войти',exact:true}).click();await b.page.getByRole('button',{name:'Микрофон: выключен',exact:true}).click();
 await until(async()=> (await stats(b)).flatMap(pc=>pc.inbound).filter(r=>r.kind==='audio'&&r.bytesReceived>0).length===2,30000);record(current);
 current='reload within grace keeps same CallSession';await c.page.reload();await ready(c);
 await c.page.getByRole('button',{name:'Микрофон: выключен',exact:true}).click();await until(async()=> (await stats(c)).some(pc=>pc.inbound.some(r=>r.kind==='audio'&&r.bytesReceived>0)),30000);
 assert.equal((await http(c,`/rooms/${group.id}/active-call`)).callId,groupInvite.callId);record(current);
 current='LiveKit signaling disconnect independent of STOMP';const stompBefore=await c.page.evaluate(()=>window.__sockets.filter(s=>s.readyState===1&&s.url.includes(':18080/')).length),recoverAt=Date.now();
 await c.page.evaluate(()=>window.__sockets.filter(s=>s.readyState===1&&s.url.includes(':17880/')).forEach(s=>s.close()));
 await until(async()=> (await stats(c)).some(pc=>pc.connectionState==='connected'&&pc.inbound.some(r=>r.kind==='audio'&&r.bytesReceived>0)),30000);
 assert.equal(await c.page.evaluate(()=>window.__sockets.filter(s=>s.readyState===1&&s.url.includes(':18080/')).length),stompBefore);
 assert.equal((await http(c,`/rooms/${group.id}/active-call`)).callId,groupInvite.callId);record(current,{observedRecoveryMs:Date.now()-recoverAt,scope:'signaling socket only; media packets may continue'});
 if(process.env.STAGE10_SFU_OUTAGE==='1') {
  current='real SFU pause stops RTP and resume restores it with live STOMP';
  const {execFileSync}=require('node:child_process');
  const label=execFileSync('docker',['inspect','--format','{{index .Config.Labels "zvonok.acceptance"}}','zvonok-stage10-livekit'],{encoding:'utf8'}).trim();assert.equal(label,'stage10');
  const bytes=async()=> (await stats(a)).flatMap(pc=>pc.inbound).filter(r=>r.kind==='audio').reduce((n,r)=>n+r.bytesReceived,0);
  let paused1,paused2;
  try{execFileSync('docker',['pause','zvonok-stage10-livekit']);await new Promise(r=>setTimeout(r,3000));paused1=await bytes();await new Promise(r=>setTimeout(r,3000));paused2=await bytes();assert.equal(paused1,paused2);assert.equal(await a.page.evaluate(()=>window.__sockets.filter(s=>s.readyState===1&&s.url.includes(':18080/')).length),1);}
  finally{execFileSync('docker',['unpause','zvonok-stage10-livekit']);}
  const resumedAt=Date.now();await until(async()=> (await bytes())>paused2,30000);assert.equal((await http(a,`/rooms/${group.id}/active-call`)).callId,groupInvite.callId);
  record(current,{outageMs:6000,resumeToObservedRtpMs:Date.now()-resumedAt,pausedBytes:[paused1,paused2]});
 }
 current='minimized leave and last participant end';await b.page.locator('summary').filter({hasText:'Вид'}).click();await b.page.getByRole('button',{name:'Мини-режим',exact:true}).click();await b.page.getByRole('button',{name:'Завершить',exact:true}).click();
 await c.page.getByTitle('Завершить звонок',{exact:true}).click();await a.page.getByTitle('Завершить звонок',{exact:true}).click();await until(async()=> !(await http(a,`/rooms/${group.id}/active-call`))?.callId);record(current);
 current='unread preview and history clear';
 try {
 await http(b,`/rooms/${group.id}/read`,'POST');await b.page.goto(BASE+'/');await ready(b);await a.page.goto(BASE+'/dm?roomId='+group.id);await ready(a);await uiSend(a,'unread '+suffix);await visible(a,'unread '+suffix);
 await until(async()=> (await http(b,'/rooms/all')).find(r=>r.id===group.id)?.unreadCount===1);
 assert.equal((await http(b,'/rooms/all')).find(r=>r.id===group.id).lastMessageContent,'unread '+suffix);
 await b.page.bringToFront();await b.page.goto(BASE+'/dm?roomId='+group.id);await ready(b);await visible(b,'unread '+suffix);
 const scroller=b.page.locator('div[class^="_messages_"]').first();await scroller.hover();await b.page.mouse.wheel(0,10000);
 await until(async()=> (await http(b,'/rooms/all')).find(r=>r.id===group.id)?.unreadCount===0);
 await http(a,`/rooms/${group.id}/messages`,'DELETE');await until(async()=> (await http(b,`/rooms/${group.id}/messages?limit=100`)).length===0);record(current);
 } catch(e) {results.push({scenario:current,status:'FAIL',error:e.message});await b.page.screenshot({path:out+'/unread-failure.png'});fs.writeFileSync(out+'/unread-diagnostics.json',JSON.stringify({rooms:await http(b,'/rooms/all'),dom:await b.page.locator('body').innerText(),scroll:await b.page.locator('div[class^="_messages_"]').evaluateAll(es=>es.map(e=>({scrollHeight:e.scrollHeight,scrollTop:e.scrollTop,clientHeight:e.clientHeight})))},null,2));}
 current='missed DM invitation real 60 second expiry';await a.page.goto(BASE+'/dm?roomId='+dm.id);await ready(a);await a.page.locator('button').filter({has:a.page.locator('svg.lucide-phone')}).first().click();const missed=await incoming(b,'CALL_INVITE'),ringingAt=Date.now();
 await until(async()=> !(await http(a,`/rooms/${dm.id}/active-call`))?.callId,80000);const elapsed=Date.now()-ringingAt;assert.ok(elapsed>=59000);record(current,{callId:missed.callId,observedExpiryMs:elapsed});
 current='snapshot';await a.page.screenshot({path:out+'/client-a.png'});await b.page.screenshot({path:out+'/client-b.png'});
 fs.writeFileSync(out+'/scenario-resources.json',JSON.stringify({users:[a.name,b.name],dmId:dm.id,groupId:group.id}));
 record(current);
 } catch(e) {results.push({scenario:current,status:'FAIL',error:e.message.replace(/eyJ[\w.-]+/g,'[JWT]')});console.error(current,e.message);} finally {fs.writeFileSync(out+'/browser-results.json',JSON.stringify({results,errors},null,2));await browser.close();}
 if(results.some(x=>x.status==='FAIL'))process.exitCode=1;
})();
module.exports={register,http,send,stats,ready,incoming,until};

