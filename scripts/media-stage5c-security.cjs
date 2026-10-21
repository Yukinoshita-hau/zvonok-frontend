const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
(async()=>{const s=JSON.parse(fs.readFileSync(path.join(os.tmpdir(),'zvonok-stage5c-runtime.json'))),api='http://127.0.0.1:18081/api',result={status:'FAIL'};
 const req=(u,url,options={})=>fetch(api+url,{...options,headers:{Authorization:'Bearer '+u.accessToken,...options.headers}});
 try {
  assert.equal((await req(s.outsider,'/rooms/9999999999/attachments')).status,404);
  const list=await(await req(s.owner,`/rooms/${s.room.id}/attachments?limit=1`)).json(),a=list.items[0].attachment;
  for(const suffix of ['download','download-access','playback-access']){const r=await req(s.outsider,`/message-attachments/${a.id}/${suffix}`,{method:suffix==='download'?'GET':'POST'});assert.equal(r.status,404);}
  const source=await(await req(s.owner,`/rooms/${s.libraryRoom.id}/attachments?filenameQuery=stage5c-audio`)).json();assert.ok(source.items.length);
  const other=await(await req(s.owner,`/rooms/${s.room.id}/attachments?filenameQuery=stage5c-audio`)).json();assert.equal(other.items.length,0);
  const created=await req(s.owner,'/rooms/createGroup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({roomName:'Stage 5C active group revocation',roomMemberUsernames:[]})});assert.equal(created.status,201);const room=await created.json();assert.ok(Number.isSafeInteger(room.id));
  const username=s.outsider.name.replaceAll("'","''");
  const sql=`DO $$ BEGIN IF current_database()<>'zvonok_stage5c_diag' THEN RAISE EXCEPTION 'diagnostic only'; END IF; END $$; INSERT INTO room_members(room_id,user_id) SELECT ${room.id},id FROM "user" WHERE username='${username}';`;
  execFileSync('docker',['exec','zvonok-postgres','psql','-U','rashid','-d','zvonok_stage5c_diag','-v','ON_ERROR_STOP=1','-c',sql],{stdio:['ignore','pipe','pipe']});
  assert.equal((await req(s.owner,`/rooms/${room.id}/attachments`)).status,200);
  assert.equal((await req(s.owner,`/rooms/${room.id}/leave`,{method:'POST'})).status,204);
  assert.ok([403,404].includes((await req(s.owner,`/rooms/${room.id}/attachments`)).status));
  assert.equal((await req(s.outsider,`/rooms/${room.id}/attachments`)).status,200);
  Object.assign(result,{status:'PASS',guessedRoomDenied:true,outsiderOriginalAndGrantsDenied:true,crossRoomSearchIsolated:true,removedMemberDeniedWhileGroupRemainsActive:true});
 }catch(e){result.error=e.message;process.exitCode=1;}finally{fs.writeFileSync('artifacts/stages/media-stage5c-evidence/security-results.json',JSON.stringify(result,null,2));console.log(result);}})();
