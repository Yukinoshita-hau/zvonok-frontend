// Uses the already bundled Playwright; no new dependency or production endpoint.
const { chromium } = require(process.env.STAGE10_PLAYWRIGHT || 'C:/Users/Пользователь/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const BASE='http://localhost:3000', API='http://localhost:8080/api';
const out='artifacts/stages/call-accepted-evidence/'+(process.env.CALL_CHECK_RUN || 'before'); fs.mkdirSync(out,{recursive:true});
 const results=[], errors=[], serverUrls=[];
const participants=[];
const record=(scenario,details={})=>{results.push({scenario,status:'PASS',...details}); console.log('PASS',scenario);};
async function until(fn,timeout=15000) { const end=Date.now()+timeout; let last; while(Date.now()<end) { try {const x=await fn();if(x)return x;}catch(e){last=e;} await new Promise(r=>setTimeout(r,100)); } throw last || Error('condition timeout'); }
async function http(u,path,method='GET',body) { const r=await u.page.request.fetch(API+path,{method,headers:{Authorization:`Bearer ${u.token}`},data:body}); if(!r.ok())throw Error(`${method} ${path.split('?')[0]}: ${r.status()}`);return r.status()===204?null:r.json(); }
async function send(u,dest,payload) { await u.page.evaluate(({dest,payload})=>{ const ws=window.__sockets.findLast(s=>s.readyState===1&&s.url.includes(':8080/')); if(!ws)throw Error('no app WebSocket');const body=payload===undefined?'':JSON.stringify(payload);ws.send(`SEND\ndestination:${dest}\ncontent-type:application/json\ncontent-length:${new TextEncoder().encode(body).length}\n\n${body}\0`); },{dest,payload}); }
async function ready(u) { await u.page.waitForFunction(()=>window.__frames.some(f=>f.startsWith('CONNECTED'))); }
async function login(browser,name) {
 const context=await browser.newContext({permissions:['microphone','camera'],viewport:{width:1440,height:1000}}),page=await context.newPage();
 const u={context,page,name};
 participants.push(u);
 await page.addInitScript(()=>{
  window.__sockets=[];window.__frames=[];window.__pcs=[];window.__mediaTracks=[];window.__audioContexts=[];window.__timeline=[];
  window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__=()=> (...enhancers)=> createStore=> (reducer,...args)=> {
   const observed=(state,action)=>{const next=reducer(state,action);if(action.type.startsWith('call/')||action.type.startsWith('activeCall/')){
    const c=next.call; window.__timeline.push({time:Date.now(),action:action.type,event:action.payload?.type,reason:action.payload?.endReason,requestId:action.meta?.requestId,
     callId:c.callId,chatRoomId:c.chatRoomId,roomName:c.livekitRoomName,status:c.status,generation:c.mediaGeneration,hasToken:!!c.participantToken,tokenRequestId:c.tokenRequestId,restoreRequestId:c.restoreRequestId});} return next;};
   const store=enhancers.reduceRight((f,e)=>e(f),createStore)(observed,...args);window.__callStore=store;return store;
  };
  const Original=window.WebSocket; window.WebSocket=class extends Original {constructor(...a){super(...a);window.__sockets.push(this);this.addEventListener('message',e=>window.__frames.push(String(e.data)));}};
  const PC=window.RTCPeerConnection;window.RTCPeerConnection=class extends PC {constructor(...a){super(...a);window.__pcs.push(this);}};
  const gum=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=async(...a)=>{const stream=await gum(...a);window.__mediaTracks.push(...stream.getTracks());return stream;};
  const AC=window.AudioContext;window.AudioContext=class extends AC {constructor(...a){super(...a);window.__audioContexts.push(this);}};
 });
 page.on('response',async r=>{if(r.url().startsWith(API+'/calls/')&&r.ok()){try{const d=await r.json();if(d.serverUrl)serverUrls.push(d.serverUrl);}catch{}}});
 page.on('pageerror',e=>errors.push({user:name,type:'pageerror',message:e.message.replace(/eyJ[\w.-]+/g,'[JWT]')}));
 page.on('console',m=>{if(m.type()==='error')errors.push({user:name,type:'console',message:m.text().replace(/eyJ[\w.-]+/g,'[JWT]')});});
 const register=process.env.CALL_CHECK_ISOLATED==='1'&&!process.env.CALL_CHECK_DUP_LOGIN,action=register?'register':'login';
 await page.goto(BASE+'/auth/'+action);
 if(register){await page.locator('[name=username]').fill(name);await page.locator('[name=email]').fill(name+'@test.invalid');}
 else await page.locator('[name=usernameOrEmail]').fill(name);
 await page.locator('[name=password]').fill(process.env.LOCAL_CALL_TEST_PASSWORD);
 const response=page.waitForResponse(r=>r.url()===API+'/auth/'+action);await page.locator('form button').click();const r=await response;assert.equal(r.status(),register?201:200);u.token=(await r.json()).accessToken;
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

async function snapshot(u,label) {
 const details=await u.page.evaluate(()=>({timeline:window.__timeline,events:window.__frames.flatMap(f=>{try{return [JSON.parse(f.slice(f.indexOf('\n\n')+2).replace(/\0$/,''))];}catch{return [];}}).filter(f=>f.type?.startsWith('CALL_'))}));
 fs.writeFileSync(out+'/'+label+'-'+u.name+'.json',JSON.stringify({...details,userId:u.me.id,rtp:await rtp(u)},null,2));
 fs.writeFileSync(out+'/'+label+'-'+u.name+'-dom.txt',await u.page.locator('body').innerText());
}
async function livekitState(u) {
 return u.page.evaluate(()=>{
  const root=document.getElementById('root'),key=Object.keys(root).find(k=>k.startsWith('__reactContainer$'));
  const fiber=root[key],stack=[fiber.stateNode?.current||fiber];
  while(stack.length){const node=stack.pop(),room=node.memoizedProps?.value;
   if(room?.localParticipant&&room.remoteParticipants instanceof Map)return {state:room.state,name:room.name,local:room.localParticipant.identity,remote:[...room.remoteParticipants.keys()]};
   if(node.child)stack.push(node.child);if(node.sibling)stack.push(node.sibling);
  }return null;
 });
}
async function connected(users) {
 for(const u of users) await until(async()=>{
  const s=await rtp(u);return bytes(s,'inbound')>0&&bytes(s,'outbound')>0;
 },30000);
 const before=await Promise.all(users.map(rtp));await new Promise(r=>setTimeout(r,2000));const after=await Promise.all(users.map(rtp));
 const rooms=await Promise.all(users.map(livekitState));
 for(let i=0;i<users.length;i++){
  assert.ok(bytes(after[i],'inbound')>bytes(before[i],'inbound'));assert.ok(bytes(after[i],'outbound')>bytes(before[i],'outbound'));
  assert.ok(after[i].some(p=>p.state==='connected'&&['connected','completed'].includes(p.ice)));
  assert.equal(await users[i].page.evaluate(()=>window.__callStore.getState().call.status),'in_call');
  assert.equal(await users[i].page.locator('button[class*="participant-card"]').count(),users.length);
  assert.equal(rooms[i]?.state,'connected');assert.equal(rooms[i].remote.length,users.length-1);assert.equal(rooms[i].name,rooms[0].name);
 }
 return {before,after,rooms};
}
async function unmute(u) {await u.page.getByRole('button',{name:'Микрофон: выключен',exact:true}).click({timeout:10000});}
async function hangup(a,b) {
 await a.page.getByTitle('Завершить звонок',{exact:true}).click();
 for(const u of [a,b]) await until(()=>u.page.evaluate(()=>window.__callStore.getState().call.callId===null&&window.__pcs.every(p=>p.connectionState==='closed')&&window.__mediaTracks.every(t=>t.readyState==='ended')&&window.__audioContexts.every(c=>c.state==='closed')));
}

(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required']});
 let a,b;
 try {
  const isolated=process.env.CALL_CHECK_ISOLATED==='1',suffix=Date.now().toString(36);
  a=await login(browser,isolated?'caa'+suffix:process.env.LOCAL_CALL_TEST_A);b=await login(browser,isolated?'cab'+suffix:process.env.LOCAL_CALL_TEST_B);
  let rooms=await http(a,'/rooms/all'),dm=rooms.find(r=>r.type==='PRIVATE'&&r.members.some(m=>m.username===b.name));
  if(isolated){await send(a,'/app/friend/send/'+b.name);const request=await until(async()=>(await http(b,'/friends/requests/incoming')).find(r=>r.senderUsername===a.name));await send(b,'/app/friend/accept/'+request.requestId);dm=await until(async()=>(await http(a,'/rooms/all')).find(r=>r.type==='PRIVATE'&&r.members.some(m=>m.username===b.name)));}
  assert.ok(dm);record('accounts and DM',{isolated,users:[a.name,b.name],roomId:dm.id});
  for(const u of [a,b]) {await u.page.goto(BASE+'/dm?roomId='+dm.id);await ready(u);}
  const existing=await http(a,`/rooms/${dm.id}/active-call`);
  if(existing?.callId) {await send(a,'/app/call/end',{callId:existing.callId,chatRoomId:dm.id});await until(async()=>!(await http(a,`/rooms/${dm.id}/active-call`))?.callId);}
  await until(()=>a.page.evaluate(()=>['idle','ended'].includes(window.__callStore.getState().call.status)));
  if(process.env.CALL_CHECK_MULTI==='1'){process.env.CALL_CHECK_DUP_LOGIN='1';const extra=await login(browser,a.name);delete process.env.CALL_CHECK_DUP_LOGIN;await extra.page.goto(BASE+'/dm?roomId='+dm.id);await ready(extra);}
  if((process.env.CALL_CHECK_RUN||'before')!=='before') {
   for(let i=1;i<=(process.env.CALL_CHECK_GROUP_ONLY==='1'?0:5);i++){
    await a.page.locator('button').filter({has:a.page.locator('svg.lucide-phone')}).first().click();
    await b.page.locator('button[class*="accept-button"]').waitFor();
    if(i===2) await new Promise(r=>setTimeout(r,1500));
    if(i===3) {
     const count=await a.page.evaluate(()=>window.__frames.filter(f=>f.startsWith('CONNECTED')).length);
     await a.page.evaluate(()=>window.__sockets.filter(s=>s.readyState===1&&s.url.includes(':8080/')).forEach(s=>s.close()));
     await until(()=>a.page.evaluate(n=>window.__frames.filter(f=>f.startsWith('CONNECTED')).length>n,count));
    }
    await b.page.locator('button[class*="accept-button"]').click();
    await unmute(a);await unmute(b);
    const states=await Promise.all([a,b].map(u=>u.page.evaluate(()=>{const c=window.__callStore.getState().call;return {callId:c.callId,room:c.livekitRoomName};})));
    assert.deepEqual(states[0],states[1]);record('DM '+i,{...states[0],...await connected([a,b])});
    for(const u of [a,b])await snapshot(u,'dm'+i);
    if(i===4){await a.page.reload();await ready(a);await unmute(a);record('reload restore',await connected([a,b]));}
    await hangup(a,b);record('DM '+i+' cleanup');
   }
   if(process.env.CALL_CHECK_GROUP_ONLY!=='1'){
    await a.page.locator('button').filter({has:a.page.locator('svg.lucide-phone')}).first().click();await b.page.locator('button[class*="decline-button"]').click();
    await until(async()=>!(await http(a,`/rooms/${dm.id}/active-call`))?.callId);record('decline no phantom call');
   }
   if(isolated&&process.env.CALL_CHECK_GROUP_ONLY==='1'){
    const c=await login(browser,'cac'+suffix),users=[a,b,c];
    await send(a,'/app/friend/send/'+c.name);const request=await until(async()=>(await http(c,'/friends/requests/incoming')).find(r=>r.senderUsername===a.name));await send(c,'/app/friend/accept/'+request.requestId);
    await until(async()=>(await http(a,'/rooms/all')).some(r=>r.type==='PRIVATE'&&r.members.some(m=>m.username===c.name)));
    const group=await http(a,'/rooms/createGroup','POST',{roomName:'Call accepted regression '+suffix,roomMemberUsernames:[b.name,c.name]});
    for(const u of users){await u.page.goto(BASE+'/dm?roomId='+group.id);await ready(u);}
    await a.page.locator('button').filter({has:a.page.locator('svg.lucide-phone')}).first().click();
    await b.page.locator('button[class*="accept-button"]').click();
    await c.page.locator('button[class*="accept-button"]').click();
    for(const u of users)await unmute(u);
    record('GROUP three participants',{roomId:group.id,...await connected(users)});
    for(const u of users)await snapshot(u,'group');
    await b.page.getByTitle('Завершить звонок',{exact:true}).click();
    await until(()=>b.page.evaluate(()=>window.__callStore.getState().call.callId===null&&window.__pcs.every(p=>p.connectionState==='closed')));
    await b.page.getByRole('button',{name:'Войти',exact:true}).click();await unmute(b);
    record('GROUP rejoin',await connected(users));
    for(const u of users)await snapshot(u,'group-rejoin');
    await hangup(a,b);
    await until(()=>c.page.evaluate(()=>window.__callStore.getState().call.callId===null&&window.__pcs.every(p=>p.connectionState==='closed')&&window.__mediaTracks.every(t=>t.readyState==='ended')&&window.__audioContexts.every(c=>c.state==='closed')));
    record('GROUP cleanup');
   }
   return;
  }
  await a.page.locator('button').filter({has:a.page.locator('svg.lucide-phone')}).first().click();
  await b.page.locator('button[class*="accept-button"]').click();
  await new Promise(r=>setTimeout(r,3000));
  for(const u of [a,b]) {
   await snapshot(u,'diagnostic');
   fs.writeFileSync(out+'/'+u.name+'-timeline.json',JSON.stringify(await u.page.evaluate(()=>window.__timeline),null,2));
   fs.writeFileSync(out+'/'+u.name+'-events.json',JSON.stringify(await u.page.evaluate(()=>window.__frames.flatMap(f=>{try{return [JSON.parse(f.slice(f.indexOf('\n\n')+2).replace(/\0$/,''))];}catch{return [];}}).filter(f=>f.type?.startsWith('CALL_'))),null,2));
   fs.writeFileSync(out+'/'+u.name+'-dom.txt',await u.page.locator('body').innerText());
   fs.writeFileSync(out+'/'+u.name+'-rtp.json',JSON.stringify(await rtp(u),null,2));
  }
 } catch(e){results.push({status:'FAIL',error:e.message});for(const u of participants)await snapshot(u,'failure').catch(()=>{});console.error(e.message);process.exitCode=1;}
 finally {fs.writeFileSync(out+'/results.json',JSON.stringify({results,errors,serverUrls},null,2));await browser.close();}
})();


