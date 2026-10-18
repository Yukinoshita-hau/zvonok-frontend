const {chromium}=require(process.env.STAGE10_PLAYWRIGHT || 'C:/Users/Пользователь/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {register,http,send,stats,incoming,until}=require('./stage10-acceptance.cjs');
const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required']});
 const result={status:'NOT RUN',scope:'real local SFU, synthetic media, all clients navigate away'};
 try{
 const suffix=Date.now().toString(36),a=await register(browser,'s10ga'+suffix),b=await register(browser,'s10gb'+suffix);
 const group=await http(a,'/rooms/createGroup','POST',{roomName:'stage10 grace '+suffix,roomMemberUsernames:[]});
 const invite=await http(a,`/rooms/${group.id}/invites`,'POST',{});await http(b,`/invites/${invite.inviteToken}/join`,'POST');
 await send(a,'/app/call/invite',{chatRoomId:group.id,callType:'audio'});const call=await incoming(b,'CALL_INVITE');await b.page.locator('button[class*="accept-button"]').click();
 for(const u of [a,b])await u.page.getByRole('button',{name:'Микрофон: выключен',exact:true}).click();
 for(const u of [a,b])await until(async()=> (await stats(u)).some(pc=>pc.inbound.some(r=>r.kind==='audio'&&r.bytesReceived>0)),30000);
 await a.page.goto('about:blank');await b.page.goto('about:blank');const emptyAt=Date.now();
 console.log('Real media clients disconnected; waiting for server grace cleanup');
 await new Promise(r=>setTimeout(r,10000));const within=await http(a,'/calls/restore');assert.equal(within.callId,call.callId);
 result.withinGraceRestoreCallId=within.callId;console.log('PASS restore remains authorized within grace');
 // Current policy also gives the session its initial 120s connection window and a 30s sweep.
 await until(async()=> !(await http(a,`/rooms/${group.id}/active-call`))?.callId,300000);
 result.disconnectToCleanupMs=Date.now()-emptyAt;assert.ok(result.disconnectToCleanupMs>=89000);
 assert.equal((await http(a,'/calls/restore')).callRestoreType,'NONE');
 const token=await a.page.request.post(`http://127.0.0.1:18080/api/calls/${call.callId}/token`,{headers:{Authorization:`Bearer ${a.token}`}});assert.equal(token.status(),403);
 Object.assign(result,{status:'PASS',callId:call.callId,roomId:group.id,afterGraceTokenStatus:token.status()});console.log('PASS after grace cleanup, restore NONE, token 403');
 }catch(e){result.status='FAIL';result.error=e.message;process.exitCode=1;console.error(e.message);}
 finally{fs.writeFileSync('stage10-evidence/grace-results.json',JSON.stringify(result,null,2));await browser.close();}
})();
