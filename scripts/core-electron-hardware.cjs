// Real devices only. Do not save microphone samples, camera images or screen content.
const {_electron}=require('C:/Users/Пользователь/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
(async()=>{
 const env={...process.env,VITE_DEV_SERVER_URL:'http://localhost:3000',ZVONOK_DESKTOP_WEB_ORIGIN:'http://localhost:3000'};delete env.ELECTRON_RUN_AS_NODE;
 const app=await _electron.launch({executablePath:path.resolve('artifacts/stages/release/win-unpacked.tmp/electron.exe'),args:[path.resolve('.'),'--user-data-dir='+fs.mkdtempSync(path.join(os.tmpdir(),'zvonok-core-hardware-'))],env,timeout:30000});
 try{
  await app.firstWindow();let page;
  for(let i=0;i<100;i++){page=app.windows().find(p=>p.url().startsWith('http://localhost:3000'));if(page)break;await new Promise(r=>setTimeout(r,100));}
  assert.ok(page,'application window');await page.goto('http://localhost:3000/auth/register');await page.locator('[name=username]').waitFor();
  const result=await page.evaluate(async()=>{
   const devices=await navigator.mediaDevices.enumerateDevices(),results=[];
   for(const [kind,label]of [['audioinput',/Realtek/i],['videoinput',/Chicony/i]]){
    const device=devices.find(d=>d.kind===kind&&label.test(d.label));
    if(!device){results.push({kind,status:'BLOCKED',reason:'Physical device not exposed'});continue;}
    let stream;
    try{
     stream=await navigator.mediaDevices.getUserMedia(kind==='audioinput'?{audio:{deviceId:{exact:device.deviceId}}}:{video:{deviceId:{exact:device.deviceId}}});
     const track=stream.getTracks()[0],settings=track.getSettings();let frames;
     if(kind==='videoinput'){const video=document.createElement('video');video.muted=true;video.srcObject=stream;await video.play();await new Promise(r=>setTimeout(r,1500));frames=video.getVideoPlaybackQuality().totalVideoFrames;video.srcObject=null;}
     const live=track.readyState;stream.getTracks().forEach(t=>t.stop());
     results.push({kind,label:device.label,status:live==='live'&&(kind!=='videoinput'||frames>0)&&track.readyState==='ended'?'PASS':'FAIL',frames,settings:{width:settings.width,height:settings.height,frameRate:settings.frameRate,sampleRate:settings.sampleRate,channelCount:settings.channelCount},ended:track.readyState==='ended'});
    }catch(e){results.push({kind,label:device.label,status:'BLOCKED',reason:e.name});}finally{stream?.getTracks().forEach(t=>t.stop());}
   }
   return results;
  });
  await page.evaluate(()=>{document.title='Zvonok Core Acceptance Capture';});
  const screen=await page.evaluate(async()=>{
   let stream;
   try{
    const sources=await window.zvonokDesktop.getScreenShareSources();
    const own=sources.find(s=>s.type==='window'&&s.name==='Zvonok Core Acceptance Capture');
    if(!own)return {kind:'window-capture',status:'BLOCKED',reason:'Own application window not available'};
    await window.zvonokDesktop.setSelectedScreenShareSource(own.id,false);
    stream=await navigator.mediaDevices.getDisplayMedia({video:true,audio:false});
    const video=document.createElement('video');video.muted=true;video.srcObject=stream;await video.play();await new Promise(r=>setTimeout(r,1500));
    const frames=video.getVideoPlaybackQuality().totalVideoFrames;video.srcObject=null;stream.getTracks().forEach(t=>t.stop());
    return {kind:'window-capture',status:frames>0&&stream.getTracks().every(t=>t.readyState==='ended')?'PASS':'FAIL',frames,ownApplicationOnly:true};
   }catch(e){return {kind:'window-capture',status:'BLOCKED',reason:e.name};}finally{stream?.getTracks().forEach(t=>t.stop());await window.zvonokDesktop.clearSelectedScreenShareSource();}
  });
  result.push(screen);
  fs.writeFileSync('artifacts/stages/core-final-evidence/electron-hardware.json',JSON.stringify({results:result,limits:['Capture and cleanup only; no acoustic quality or hardware RTP certification']},null,2));console.log(result);
 }finally{await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
