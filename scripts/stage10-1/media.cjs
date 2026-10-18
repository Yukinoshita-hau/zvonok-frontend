const c=require('./common.cjs'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const audioBytes=async u=>(await c.stats(u)).filter(p=>p.connectionState==='connected').flatMap(p=>p.inbound).filter(r=>r.kind==='audio').reduce((s,r)=>s+r.bytesReceived,0);
const openPcs=async u=>u.page.evaluate(()=>window.__pcs.filter(p=>p.connectionState!=='closed').length);
async function mic(u){const off=u.page.getByRole('button',{name:'Микрофон: выключен',exact:true});await off.click();}
async function group(a,users,title){const g=await c.http(a,'/rooms/createGroup','POST',{roomName:title,roomMemberUsernames:[]});const i=await c.http(a,`/rooms/${g.id}/invites`,'POST',{});for(const u of users)await c.http(u,`/invites/${i.inviteToken}/join`,'POST');return g;}
(async()=>{const b=await c.browser(),r=c.runner(process.env.STAGE101_DM_ONLY?'media-dm-repeat.json':'media-results.json'),suffix=Date.now().toString(36);let a,x,z,dm,call,groupCall,gr;
try{
a=await c.register(b,'s101ma'+suffix);x=await c.register(b,'s101mb'+suffix);z=await c.register(b,'s101mc'+suffix);
await r.run('compatible server DM connect, camera, authorization and real JWT expiry during live media',async()=>{
 await c.send(a,'/app/friend/send/'+x.name);const req=await c.until(async()=>(await c.http(x,'/friends/requests/incoming'))[0]);await c.send(x,'/app/friend/accept/'+req.requestId);
 dm=await c.until(async()=>(await c.http(a,'/rooms/all')).find(r=>r.type==='PRIVATE'));for(const u of [a,x])await c.room(u,dm.id);
 await a.page.locator('button').filter({has:a.page.locator('svg.lucide-phone')}).first().click();call=await c.incoming(x,'CALL_INVITE');await x.page.locator('button[class*="accept-button"]').click();for(const u of [a,x])await mic(u);
 for(const u of [a,x])await c.until(async()=> (await audioBytes(u))>0,30000).catch(async error=>{c.save('media-dm-timeout-'+suffix+'.json',{a:{state:await c.state(a),stats:await c.stats(a),console:a.console},b:{state:await c.state(x),stats:await c.stats(x),console:x.console}});throw error;});
 const oldToken=await c.token(a),before=await audioBytes(a),pcs=await openPcs(a);const oldExp=JSON.parse(Buffer.from(oldToken.split('.')[1],'base64url')).exp*1000;
 await a.page.getByTitle('Камера выключена',{exact:true}).click();await c.until(async()=>(await c.stats(x)).some(pc=>pc.inbound.some(v=>v.kind==='video'&&v.framesDecoded>0)),30000);await a.page.getByTitle('Камера включена',{exact:true}).click();
 await sleep(Math.max(0,oldExp-Date.now()+1800));const expired=await a.page.request.get(c.API+'/auth/me',{headers:{Authorization:'Bearer '+oldToken}});assert.equal(expired.status(),401);assert.ok((await audioBytes(a))>before);assert.equal(await openPcs(a),pcs);assert.equal((await c.state(a)).call.id,call.callId);
 const identity=await a.page.evaluate(()=>window.__sockets.filter(s=>s.readyState===1&&s.url.includes(':18080/')).map(s=>JSON.parse(atob(new URL(s.url).searchParams.get('token').split('.')[1])).sub));assert.deepEqual(identity,[a.name]);assert.notEqual(await c.token(a),oldToken);
 const outsider=await c.request(z,`/calls/${call.callId}/token`,'POST');assert.ok([403,404].includes(outsider.status()));
 return {callId:call.callId,expiredOldJwt:401,pcsPreserved:pcs,connections:a.wsPaths,rtcConsoleErrors:a.console.filter(x=>/rtc|WebSocket/.test(x)),receiverStats:await c.stats(x),outsider:outsider.status()};
});
await r.run('missed CALL_ENDED with live browser and STOMP recovery releases media',async()=>{
 const start=await x.page.evaluate(()=>window.__frames.length);await x.page.evaluate(()=>window.__sockets.filter(s=>s.readyState===1&&s.url.includes(':18080/')).forEach(s=>s.close()));
 await a.page.getByTitle('Завершить звонок',{exact:true}).click();await c.until(async()=>!(await c.state(x)).call.id,15000);await c.ready(x);
 assert.equal(await openPcs(a),0);assert.equal(await openPcs(x),0);const missed=await x.page.evaluate(start=>window.__frames.slice(start).every(f=>!f.includes('CALL_ENDED')),start);assert.ok(missed);
 for(const u of [a,x])assert.ok(await u.page.evaluate(()=>window.__mediaTracks.every(t=>t.readyState==='ended')&&window.__audioContexts.every(c=>c.state==='closed')));
 assert.equal(c.sql(`select status from call_session where id=${call.callId}`),'ENDED');return {callId:call.callId,CALL_ENDED_notReceived:true,browserContextAlive:true};
});
if(process.env.STAGE101_DM_ONLY){if(r.results.some(v=>v.status==='FAIL'))process.exitCode=1;return;}
await r.run('GROUP start two clients and retain third invitation until real expiry',async()=>{
 gr=await group(a,[x,z],'stage101 media '+suffix);for(const u of [a,x,z])await c.room(u,gr.id);
 await a.page.locator('button').filter({has:a.page.locator('svg.lucide-phone')}).first().click();groupCall=await c.incoming(x,'CALL_INVITE');await x.page.locator('button[class*="accept-button"]').click();for(const u of [a,x])await mic(u);
 for(const u of [a,x])await c.until(async()=> (await audioBytes(u))>0,30000);const started=Date.now();
 await c.until(async()=> (await c.state(z)).call.status!=='incoming_ringing',75000);assert.ok(Date.now()-started>=55000);return {callId:groupCall.callId,waitedMs:Date.now()-started};
});
await r.run('GROUP late join after invitation expiry',async()=>{
 await z.page.getByRole('button',{name:'Войти',exact:true}).click();await mic(z);await c.until(async()=>(await c.stats(z)).filter(p=>p.connectionState==='connected').flatMap(p=>p.inbound).filter(r=>r.kind==='audio'&&r.bytesReceived>0).length===2,30000);assert.equal((await c.http(z,`/rooms/${gr.id}/active-call`)).callId,groupCall.callId);return {callId:groupCall.callId,participants:3};
});
await r.run('reload during active GROUP call rejoins the existing session',async()=>{
 await z.page.reload();await c.ready(z);const join=z.page.getByRole('button',{name:'Войти',exact:true});const end=z.page.getByTitle('Завершить звонок',{exact:true});await c.until(async()=>await join.isVisible()||await end.isVisible(),20000);const explicitJoin=await join.isVisible();if(explicitJoin)await join.click();const off=z.page.getByRole('button',{name:'Микрофон: выключен',exact:true});if(await off.isVisible())await off.click();await c.until(async()=>(await audioBytes(z))>0,30000);assert.equal((await c.state(z)).call.id,groupCall.callId);assert.equal(c.sql(`select count(*) from call_session where room_id=${gr.id}`),'1');return {callId:groupCall.callId,explicitJoin,dbSessions:1};
});
await r.run('two concurrent GROUP leave and join operations keep one session',async()=>{
 await Promise.all([x.page.getByTitle('Завершить звонок',{exact:true}).click(),z.page.getByTitle('Завершить звонок',{exact:true}).click()]);await c.until(async()=> (await c.http(a,`/rooms/${gr.id}/active-call`)).participantsCount===1);
 await Promise.all([x.page.getByRole('button',{name:'Войти',exact:true}).click(),z.page.getByRole('button',{name:'Войти',exact:true}).click()]);for(const u of [x,z])await mic(u);await c.until(async()=> (await c.http(a,`/rooms/${gr.id}/active-call`)).participantsCount===3);assert.equal(c.sql(`select count(*) from call_session where room_id=${gr.id}`),'1');return {callId:groupCall.callId,dbSessions:1};
});
await r.run('repeated STOMP and SFU faults plus synthetic media soak',async()=>{
 const label=execFileSync('docker',['inspect','--format','{{index .Config.Labels "zvonok.acceptance"}}','zvonok-stage10-1-livekit'],{encoding:'utf8'}).trim();assert.equal(label,'stage10-1');
 const start=Date.now(),before=await audioBytes(a);for(let i=0;i<2;i++){
 await a.page.evaluate(()=>window.__sockets.filter(s=>s.readyState===1&&s.url.includes(':18080/')).forEach(s=>s.close()));await c.ready(a);
 try{execFileSync('docker',['pause','zvonok-stage10-1-livekit']);await sleep(4000);}finally{execFileSync('docker',['unpause','zvonok-stage10-1-livekit']);}
 await c.until(async()=> (await audioBytes(a))>before,30000);}
 await sleep(20000);assert.equal((await c.state(a)).call.id,groupCall.callId);assert.equal(c.sql(`select count(*) from call_session where room_id=${gr.id}`),'1');return {additionalObservationMs:Date.now()-start,rtpBytes:await audioBytes(a),totalCallAgeMs:Date.now()-new Date(c.sql(`select started_at from call_session where id=${groupCall.callId}`)).getTime(),faults:{STOMP:2,SFU:2},scope:'synthetic local media; not internet/NAT or audio quality'};
});
await r.run('compatible endpoint sequence contains rtc/v1 without fallback errors and final cleanup',async()=>{
 for(const u of [x,z])await u.page.getByTitle('Завершить звонок',{exact:true}).click();await a.page.getByTitle('Завершить звонок',{exact:true}).click();for(const u of [a,x,z])await c.until(async()=> (await openPcs(u))===0);
 const paths=[...a.wsPaths,...x.wsPaths,...z.wsPaths].filter(x=>x.startsWith('/rtc'));assert.ok(paths.length>0);assert.ok(paths.every(p=>p==='/rtc/v1'));
 const errors=[...a.console,...x.console,...z.console].filter(s=>/rtc|WebSocket.*404/.test(s));assert.deepEqual(errors,[]);return {paths,rtcErrors:errors,dbActive:c.sql(`select count(*) from call_session where room_id in (${dm.id},${gr.id}) and status<>'ENDED'`)};
});
}finally{for(const u of [a,x,z])if(u) c.save('media-'+u.name+'.json',{responses:u.responses,console:u.console,wsPaths:u.wsPaths});await b.close();}if(r.results.some(x=>x.status==='FAIL'))process.exitCode=1;
})().catch(e=>{console.error(c.redact(e.stack));process.exitCode=1;});
