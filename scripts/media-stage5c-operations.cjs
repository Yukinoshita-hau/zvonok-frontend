const fs=require('node:fs'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
(async()=>{
 const inspect=name=>JSON.parse(execFileSync('docker',['inspect',name],{encoding:'utf8'}))[0];
 const backend=inspect('zvonok-backend'),frontend=inspect('zvonok-frontend'),diagnostic=inspect('zvonok-stage5c-backend');
 const cfg=Object.fromEntries(backend.Config.Env.map(entry=>{const i=entry.indexOf('=');return [entry.slice(0,i),entry.slice(i+1)];}));
 const snapshot={recordedAt:new Date().toISOString(),containers:[backend,frontend,diagnostic].map(c=>({name:c.Name,image:c.Image,startedAt:c.State.StartedAt,status:c.State.Status})),rollout:'BLOCKED'};
 const sql="SELECT count(*) FROM call_session WHERE ended_at IS NULL AND status IN ('ACTIVE','RINGING')";
 snapshot.activeCallSessions=Number(execFileSync('docker',['exec','zvonok-postgres','psql','-U','rashid','-d','zvonok','-Atc',sql],{encoding:'utf8'}).trim());
 try {
  const now=Math.floor(Date.now()/1000),encode=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
  const head=encode({alg:'HS256',typ:'JWT'}),body=encode({iss:cfg.LIVEKIT_API_KEY,nbf:now-5,exp:now+60,video:{roomList:true}});
  const token=head+'.'+body+'.'+crypto.createHmac('sha256',cfg.LIVEKIT_API_SECRET).update(head+'.'+body).digest('base64url');
  const response=await fetch('http://localhost:7880/twirp/livekit.RoomService/ListRooms',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:'{}'});
  if(!response.ok)throw Error('LiveKit list status '+response.status);
  const rooms=(await response.json()).rooms||[];snapshot.livekit={status:'PASS',rooms:rooms.length,participants:rooms.reduce((n,r)=>n+(r.numParticipants||0),0)};
 }catch(e){snapshot.livekit={status:'BLOCKED',reason:e.message};}
 snapshot.reason=snapshot.activeCallSessions?'Active primary CallSession; no rollout.':'Large upload acceptance failed; no confirmed maintenance window.';
 snapshot.primaryBackendJarSha256=execFileSync('docker',['exec','zvonok-backend','sha256sum','/opt/app/app.jar'],{encoding:'utf8'}).trim().split(/\s/)[0];
 snapshot.diagnosticBackendJarSha256=execFileSync('docker',['exec','zvonok-stage5c-backend','sha256sum','/opt/app/app.jar'],{encoding:'utf8'}).trim().split(/\s/)[0];
 snapshot.stagedUploadFiles=execFileSync('docker',['exec','zvonok-stage5c-backend','sh','-c','find /tmp -type f -name "zvonok-upload-*" -print'],{encoding:'utf8'}).trim().split('\n').filter(Boolean).length;
 fs.writeFileSync('artifacts/stages/media-stage5c-evidence/operations.json',JSON.stringify(snapshot,null,2));console.log(snapshot);
})().catch(e=>{console.error(e.message);process.exitCode=1;});
