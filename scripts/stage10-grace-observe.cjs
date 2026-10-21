// Continue an existing isolated Stage10 grace observation without creating another call.
const fs=require('node:fs'),assert=require('node:assert/strict');
const [username,callId,roomId]=process.argv.slice(2);
if(!/^s10g[a-z0-9]+$/.test(username)||!/^\d+$/.test(callId)||!/^\d+$/.test(roomId))throw Error('Explicit Stage10 grace resources required');
(async()=>{
 const base='http://127.0.0.1:18080/api';
 const login=await fetch(base+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({usernameOrEmail:username,password:'Stage10-only-pass!'})});assert.equal(login.status,200);
 const token=(await login.json()).accessToken,headers={Authorization:'Bearer '+token};
 const end=Date.now()+180000;
 while(Date.now()<end){const r=await fetch(base+`/rooms/${roomId}/active-call`,{headers});if(r.status===204)break;assert.equal(r.status,200);await new Promise(r=>setTimeout(r,1000));}
 const active=await fetch(base+`/rooms/${roomId}/active-call`,{headers});assert.equal(active.status,204);
 const restore=await fetch(base+'/calls/restore',{headers});assert.equal(restore.status,200);assert.equal((await restore.json()).callRestoreType,'NONE');
 const denied=await fetch(base+`/calls/${callId}/token`,{method:'POST',headers});assert.equal(denied.status,403);
 const result={status:'PASS',callId:Number(callId),roomId:Number(roomId),observedEndedAt:new Date().toISOString(),afterGraceRestore:'NONE',afterGraceTokenStatus:403};fs.writeFileSync('artifacts/stages/stage10-evidence/grace-continuation.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
