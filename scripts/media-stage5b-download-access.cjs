const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),crypto=require('node:crypto');
(async()=>{
 const {owner,outsider,attachments}=JSON.parse(fs.readFileSync(path.join(os.tmpdir(),'zvonok-stage5b-runtime.json'))),api='http://127.0.0.1:18081/api',auth=user=>({Authorization:'Bearer '+user.accessToken}),results=[];
 for(const name of ['document.docx','archive.zip']){
  const attachment=attachments.find(a=>a.originalFileName===name),endpoint=api+`/message-attachments/${attachment.id}/download-access`;
  const response=await fetch(endpoint,{method:'POST',headers:auth(owner)});assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');const grant=await response.json();
  const original=await fetch(grant.url);assert.equal(original.status,200);assert.equal(original.headers.get('content-type'),'application/octet-stream');assert.ok(original.headers.get('content-disposition').startsWith('attachment;'));
  assert.deepEqual(Buffer.from(await original.arrayBuffer()),fs.readFileSync('artifacts/stages/media-stage5b-evidence/fixtures/'+name));
  assert.equal((await fetch(endpoint,{method:'POST',headers:auth(outsider)})).status,404);assert.equal((await fetch(endpoint,{method:'POST'})).status,401);results.push({status:'PASS',scenario:name+' scoped download bytes/disposition, outsider 404, anonymous 401'});
 }
 const create=await fetch(api+'/rooms/createGroup',{method:'POST',headers:{...auth(owner),'Content-Type':'application/json'},body:JSON.stringify({roomName:'Stage 5B download revoke',roomMemberUsernames:[]})});assert.equal(create.status,201);const room=await create.json(),form=new FormData();form.set('clientRequestId',crypto.randomUUID());form.set('files',new Blob(['revoke'],{type:'text/plain'}),'revoke.txt');
 const upload=await fetch(api+`/rooms/${room.id}/messages/attachments`,{method:'POST',headers:auth(owner),body:form});assert.equal(upload.status,200);const attachment=(await upload.json()).attachments[0],endpoint=api+`/message-attachments/${attachment.id}/download-access`;
 assert.equal((await fetch(endpoint,{method:'POST',headers:auth(owner)})).status,200);assert.equal((await fetch(api+`/rooms/${room.id}/leave`,{method:'POST',headers:auth(owner)})).status,204);assert.equal((await fetch(endpoint,{method:'POST',headers:auth(owner)})).status,404);results.push({status:'PASS',scenario:'removed GROUP member download grant denied'});
 fs.writeFileSync('artifacts/stages/media-stage5b-evidence/download-access.json',JSON.stringify({results},null,2));console.log(results);
})().catch(e=>{console.error(e.message.replace(/https?:\/\/[^\s]+/g,'[URL]'));process.exitCode=1;});
