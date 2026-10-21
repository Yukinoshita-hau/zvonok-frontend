const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const api='http://127.0.0.1:18081/api',out='artifacts/stages/media-stage5d-evidence';
(async()=>{
 const state=JSON.parse(fs.readFileSync(path.join(os.tmpdir(),'zvonok-stage5d-runtime.json'))),owner={Authorization:'Bearer '+state.owner.accessToken},outsider={Authorization:'Bearer '+state.outsider.accessToken},room=state.libraryRoom.id,attachment=JSON.parse(fs.readFileSync(out+'/browser.json')).attachmentId;
 const result={status:'FAIL'};
 try{
  assert.ok(Number.isSafeInteger(room)&&Number.isSafeInteger(attachment));
  const username=state.outsider.name;assert.match(username,/^s5d[a-f0-9]+$/);
  execFileSync('docker',['exec','-i','zvonok-postgres','psql','-U','rashid','-d','zvonok_stage5d_rustfs_diag','-v','ON_ERROR_STOP=1'],{input:`DO $$ BEGIN IF current_database()<>'zvonok_stage5d_rustfs_diag' THEN RAISE EXCEPTION 'diagnostic only'; END IF; END $$; INSERT INTO room_members(room_id,user_id) SELECT ${room},id FROM "user" WHERE username='${username}';`,stdio:['pipe','pipe','pipe']});
  const granted=await fetch(api+`/message-attachments/${attachment}/playback-access`,{method:'POST',headers:outsider});assert.equal(granted.status,200);const grant=await granted.json();
  assert.equal((await fetch(api+`/rooms/${room}/leave`,{method:'POST',headers:outsider})).status,204);
  assert.equal((await fetch(api+`/message-attachments/${attachment}/playback-access`,{method:'POST',headers:outsider})).status,404);
  assert.equal((await fetch(grant.url,{headers:{Range:'bytes=0-99'}})).status,206);result.removedMemberNewGrantDenied='PASS';result.existingGrantBoundedByTtlSeconds=Math.round((Date.parse(grant.expiresAt)-Date.now())/1000);
  execFileSync('docker',['stop','zvonok-local-s3-rustfs-1'],{stdio:'pipe'});
  const key=crypto.randomUUID(),form=new FormData();form.set('clientRequestId',key);form.set('files',new Blob([Buffer.from('%PDF-1.4\ncontrolled-failure')],{type:'application/pdf'}),'controlled-failure.pdf');
  const started=Date.now(),failed=await fetch(api+`/rooms/${room}/messages/attachments`,{method:'POST',headers:owner,body:form,signal:AbortSignal.timeout(45000)});result.failureMs=Date.now()-started;result.failureHttp=failed.status;assert.ok([500,503].includes(failed.status));
  const rows=execFileSync('docker',['exec','zvonok-postgres','psql','-U','rashid','-d','zvonok_stage5d_rustfs_diag','-Atc',`SELECT count(*) FROM message WHERE upload_request_key='${key}'`],{encoding:'utf8'}).trim();assert.equal(rows,'0');result.failedUploadNoCommit='PASS';
  const temp=execFileSync('docker',['exec','zvonok-stage5d-backend','sh','-c','find /tmp -type f -name "zvonok-upload-*" -print'],{encoding:'utf8'}).trim();assert.equal(temp,'');result.tempCleanup='PASS';result.status='PASS';
 }catch(error){result.error=error.message.replace(/https?:\/\/\S+/g,'[URL]');process.exitCode=1;}
 finally{execFileSync('docker',['start','zvonok-local-s3-rustfs-1'],{stdio:'pipe'});fs.writeFileSync(out+'/controlled-failure.json',JSON.stringify(result,null,2));console.log(result);}
})().catch(error=>{console.error(error.name);process.exitCode=1;});
