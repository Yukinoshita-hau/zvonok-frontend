const c=require('../stage10-1/common.cjs'),install=require('./browser-diagnostics.cjs'),fs=require('node:fs'),assert=require('node:assert/strict');
const OUT=process.env.STAGE102_EVIDENCE_DIR||'artifacts/stages/stage10-2-evidence',COUNT=Number(process.env.STAGE102_COUNT||30),variants=(process.env.STAGE102_VARIANTS||'legacy,delayed,simultaneous,after-connected,refresh,stomp-publish').split(','),captureDelays=(process.env.STAGE103_CAPTURE_DELAYS_MS||'500').split(',').map(Number);
fs.mkdirSync(OUT,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const total=(s,type,key)=>s.peers.filter(p=>p.connection==='connected').flatMap(p=>p.rtp).filter(v=>v.kind==='audio'&&v.type===type).reduce((sum,v)=>sum+(v[key]||0),0);
(async()=>{const browser=await c.browser(),suffix=Date.now().toString(36),results=[],signalControls=new Map();let a,b,dm,lastCall=0;
const save=(name,data)=>{let value=JSON.stringify(data,null,2);for(const [identity,alias]of [[a?.name,'A'],[b?.name,'B']])if(identity)value=value.replaceAll(identity,alias);fs.writeFileSync(OUT+'/'+name,c.redact(value));};
const checkpoint=async label=>Promise.all([a,b].map(u=>u.page.evaluate(label=>window.__mediaDiag.collect(label),label)));
const dump=async(name)=>{for(const [u,alias]of [[a,'A'],[b,'B']])if(u)save(name+'-'+alias+'.json',await u.page.evaluate(()=>({anchor:window.__mediaDiag.clockAnchor,events:window.__mediaDiag.events})));};
try{
a=await c.register(browser,'s102a'+suffix);b=await c.register(browser,'s102b'+suffix);for(const [u,label]of [[a,'A'],[b,'B']]){
 await u.context.addInitScript(install);const control={};signalControls.set(u,control);
 await u.page.routeWebSocket('**/*',async route=>{const path=new URL(route.url()).pathname;if(path==='/rtc/v1'){(control.trial.signalRouteHits??=[]).push(label);if(control.variant==='preconnect'||control.variant==='preconnect-A'&&label==='A')await control.gate;}route.connectToServer();});
}
await c.send(a,'/app/friend/send/'+b.name);const request=await c.until(async()=>(await c.http(b,'/friends/requests/incoming'))[0]);await c.send(b,'/app/friend/accept/'+request.requestId);dm=await c.until(async()=>(await c.http(a,'/rooms/all')).find(v=>v.type==='PRIVATE'));for(const u of [a,b])await c.room(u,dm.id);
if(process.env.STAGE102_RNNOISE==='1')for(const u of [a,b])await u.page.evaluate(async()=>{const {store}=await import('/src/store/store.ts');const {deviceActions}=await import('/src/store/slices/device.slice.ts');store.dispatch(deviceActions.setRnnoise(true));});
for(let i=0;i<COUNT;i++){
 const variant=variants[i%variants.length],captureDelayMs=captureDelays[i%captureDelays.length],trial={number:i+1,variant,roomId:dm.id,status:'FAIL',captureDelayMs},name=`trial-${suffix}-${String(i+1).padStart(2,'0')}`;const tasks=[];let artifacts/stages/releaseSignal;const signalGate=new Promise(resolve=>artifacts/stages/releaseSignal=resolve);
 try{
 for(const u of [a,b])await u.page.evaluate(()=>{window.__mediaDiag.events=[];window.__captureDelayMs=0;});await checkpoint('before-connect');
 for(const [u,label]of [[a,'A'],[b,'B']]){
  Object.assign(signalControls.get(u),{variant,gate:signalGate,trial});
  await u.page.unroute('**/calls/*/token');
  if(variant===`delay-${label}-token`)await u.page.route('**/calls/*/token',async route=>{const response=await route.fetch();await sleep(700);await route.fulfill({response});});
 }
 await a.page.locator('button').filter({has:a.page.locator('svg.lucide-phone')}).first().click();
 if(variant.startsWith('preconnect')){const earlyMic=a.page.getByRole('button',{name:'Микрофон: выключен',exact:true});await earlyMic.waitFor();trial.preconnectGuardObserved=await earlyMic.isDisabled();assert.ok(trial.preconnectGuardObserved,'microphone unmute must remain disabled before LiveKit connects');trial.preconnectGuardMonotonicMs=await a.page.evaluate(()=>performance.now());await checkpoint('early-unmute-blocked');artifacts/stages/releaseSignal();}
 const invite=await c.until(async()=>{const v=await c.incoming(b,'CALL_INVITE');return v.callId!==lastCall?v:false;});trial.callId=invite.callId;lastCall=invite.callId;
 if(variant==='delayed')await sleep(800);
 await b.page.locator('button[class*="accept-button"]').click();
 if(variant==='after-connected')await c.until(async()=>{const pair=await checkpoint('await-connected');return pair.every(v=>v.room?.connection==='connected');});
 if(variant==='refresh'){for(const u of [a,b])tasks.push(c.app(u,'/auth/refresh','post').catch(()=>null));}
 if(variant==='stomp-publish'||variant==='pending-exit'||variant==='logout-pending')await a.page.evaluate(ms=>window.__captureDelayMs=ms,captureDelayMs);
 const mic=async u=>{await u.page.getByRole('button',{name:'Микрофон: выключен',exact:true}).click();await u.page.evaluate(()=>window.__mediaDiag.collect('after-microphone-request'));};
 if(variant.startsWith('preconnect')){
  const off=a.page.getByRole('button',{name:'Микрофон: выключен',exact:true});await off.waitFor();
  if(await off.isDisabled()){trial.preconnectGuardObserved=true;await checkpoint('early-unmute-blocked');artifacts/stages/releaseSignal();}
 }
 if(variant==='logout-pending'){
  await mic(a);await a.page.waitForFunction(()=>window.__mediaDiag.events.some(e=>e.event==='capture.controlledDelay'),undefined,{timeout:10000});
  const result=await a.page.evaluate(async()=>{const {store}=await import('/src/store/store.ts');const {logoutUser}=await import('/src/store/slices/user.slice.ts');try{await store.dispatch(logoutUser({allDevices:false})).unwrap();return {ok:true};}catch(error){return {ok:false,error:String(error)};}});trial.logoutRequested=true;trial.logoutSucceeded=result.ok;trial.logoutError=result.error;
 }else if(variant==='simultaneous')await Promise.all([mic(a),mic(b)]);else{await mic(a);await mic(b);}
 if(variant.startsWith('preconnect')){trial.preconnectObservation=await checkpoint('preconnect-order-proof');assert.ok(trial.signalRouteHits?.includes('A'),'WebSocket order control not active; this is a harness coverage failure');}
 artifacts/stages/releaseSignal();
 if(variant==='pending-exit'||variant==='logout-pending'){
  if(variant==='logout-pending')await a.page.waitForFunction(()=>window.__mediaDiag.events.some(e=>e.event==='react.unmount'),undefined,{timeout:10000});
  trial.expected=variant==='logout-pending'?'logout while real browser capture is acquired and its result is held before LiveKit createTracks resolves':'hangup while real browser capture is acquired and its result is held before LiveKit createTracks resolves';if(variant==='pending-exit'){await a.page.getByTitle('Завершить звонок',{exact:true}).click();await checkpoint('pending-exit-immediate');}await a.page.waitForFunction(()=>window.__mediaDiag.events.some(e=>e.event==='createTracks.resolved'||e.event==='createTracks.rejected'),undefined,{timeout:10000}).catch(()=>{});trial.afterCaptureCompletion=await checkpoint('pending-exit-after-capture-completion');trial.captureTimeline=await a.page.evaluate(()=>{const e=window.__mediaDiag.events;const pick=name=>e.find(v=>v.event===name);const unmount=pick('react.unmount'),stop=pick('capture.stop.completed');return {callId:unmount?.callId,mediaGeneration:unmount?.generation,terminalUnmountMonotonicMs:unmount?.monotonicMs,captureRequestMonotonicMs:pick('capture.request')?.monotonicMs,captureResolvedMonotonicMs:pick('capture.resolved')?.monotonicMs,createTracksResolvedMonotonicMs:pick('createTracks.resolved')?.monotonicMs,publishRequestMonotonicMs:pick('publishTrack.request')?.monotonicMs,publishResolvedMonotonicMs:pick('publishTrack.resolved')?.monotonicMs,stopRequestMonotonicMs:pick('capture.stop.request')?.monotonicMs,stopCompletedMonotonicMs:stop?.monotonicMs,stopReadyState:stop?.track?.readyState,stopAfterUnmountMs:unmount&&stop?Math.round(stop.monotonicMs-unmount.monotonicMs):null,latePublishAfterUnmount:Boolean(unmount&&pick('publishTrack.request')&&pick('publishTrack.request').monotonicMs>unmount.monotonicMs)};});assert.equal(trial.captureTimeline.stopReadyState,'ended');assert.equal(trial.captureTimeline.latePublishAfterUnmount,false);if(variant==='logout-pending')assert.equal(trial.logoutSucceeded,true);trial.status='PASS';
 }else{
 if(variant==='stomp-publish')await a.page.evaluate(()=>window.__sockets.filter(s=>s.readyState===1&&s.url.includes(':18080/')).forEach(s=>s.close()));
 const start=performance.now();let previous=await checkpoint('publication-requested'),last=[];
 for(const seconds of [1,3,5,10]){
  await sleep(Math.max(0,seconds*1000-(performance.now()-start)));last=await checkpoint('t+'+seconds+'s');
 }
 // Keep the original 30-second deadline; successful audio needs growth in both directions.
 await c.until(async()=>{const current=await checkpoint('rtp-check');const ok=current.every((s,index)=>total(s,'inbound-rtp','bytesReceived')>total(previous[index],'inbound-rtp','bytesReceived')&&total(s,'outbound-rtp','bytesSent')>0);last=current;return ok;},Math.max(100,30000-(performance.now()-start)));
 trial.status='PASS';trial.stats=last.map(s=>({room:s.room,peers:s.peers,playback:s.playback}));trial.localDurationMs=Math.round(performance.now()-start);
 const count=c.sql(`select count(*) from call_session where room_id=${dm.id}`);assert.equal(Number(count),i+1);
 }
 }catch(error){trial.status='FAIL';trial.error=c.redact(error.message);trial.stats=await checkpoint('immediately-before-timeout-teardown');}
 finally{
  artifacts/stages/releaseSignal();
  await dump(name+'-before-end');
  try{for(const u of [a,b]){const end=u.page.getByTitle('Завершить звонок',{exact:true});if(await end.isVisible()){await end.click();break;}}await c.until(async()=>!(await c.state(a)).call.id&&!(await c.state(b)).call.id,15000);await checkpoint('terminal-disconnect');await dump(name+'-terminal');
   const inspect=()=>Promise.all([a,b].map(u=>u.page.evaluate(()=>({openPeers:window.__pcs.filter(p=>p.connectionState!=='closed').length,liveTracks:window.__mediaTracks.filter(t=>t.readyState!=='ended').length,openContexts:window.__audioContexts.filter(a=>a.state!=='closed').length}))));
   let cleanup=await inspect();trial.initialCleanup=cleanup;
   if(variant==='pending-exit'||variant==='logout-pending'){
    const started=performance.now();await c.until(async()=>{cleanup=await inspect();await checkpoint('terminal-capture-settling');return cleanup.every(v=>v.openPeers===0&&v.liveTracks===0&&v.openContexts===0);},16000);trial.cleanupObservationMs=Math.round(performance.now()-started);await dump(name+'-after-sdk-cleanup');
   }
   trial.cleanup=cleanup;assert.ok(cleanup.every(v=>v.openPeers===0&&v.liveTracks===0&&v.openContexts===0));
  }catch(error){trial.cleanupError=error.message;trial.status='FAIL';}
  await Promise.allSettled(tasks);results.push(trial);save('dm-results-'+suffix+'.json',results);console.table([{trial:trial.number,variant,status:trial.status,callId:trial.callId,error:trial.error||trial.cleanupError||''}]);
 }
 if(trial.cleanupError)break;
}
save('dm-summary-'+suffix+'.json',{calls:results.length,pass:results.filter(v=>v.status==='PASS').length,fail:results.filter(v=>v.status==='FAIL').length,roomId:dm.id});
}finally{await dump('final-'+suffix);await browser.close();}if(results.some(v=>v.status==='FAIL'))process.exitCode=1;
})().catch(error=>{console.error(c.redact(error.stack));process.exitCode=1;});
