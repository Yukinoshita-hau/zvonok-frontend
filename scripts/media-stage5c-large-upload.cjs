const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),assert=require('node:assert/strict');
(async()=>{
 const state=JSON.parse(fs.readFileSync(path.join(os.tmpdir(),'zvonok-stage5c-runtime.json'))),result={status:'FAIL'};
 try {
  const bytes=fs.readFileSync('artifacts/stages/media-stage5a-evidence/progressive.mp4'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
  const form=new FormData();form.set('clientRequestId',crypto.randomUUID());form.set('content','Stage 5C final async upload acceptance');form.set('files',new Blob([bytes],{type:'video/mp4'}),'stage5c-large.mp4');
  const started=Date.now(),headers={Authorization:'Bearer '+state.owner.accessToken};
  const response=await fetch(`http://127.0.0.1:18081/api/rooms/${state.libraryRoom.id}/messages/attachments`,{method:'POST',headers,body:form});
  assert.equal(response.status,200,await response.clone().text());const message=await response.json(),attachment=message.attachments[0];
  assert.equal(attachment.sizeBytes,bytes.length);
  const committed=await fetch(`http://127.0.0.1:18081/api/rooms/${state.libraryRoom.id}/messages/${message.id}`,{headers});assert.equal(committed.status,200);assert.equal((await committed.json()).attachments[0].id,attachment.id);
  const access=await fetch(`http://127.0.0.1:18081/api/message-attachments/${attachment.id}/download-access`,{method:'POST',headers});assert.equal(access.status,200);
  const grant=await access.json(),download=await fetch(grant.url);assert.equal(download.status,200);const original=Buffer.from(await download.arrayBuffer());assert.equal(hash(original),hash(bytes));
  Object.assign(result,{status:'PASS',bytes:bytes.length,sha256:hash(bytes),messageId:message.id,attachmentId:attachment.id,elapsedMs:Date.now()-started});
 }catch(e){result.error=e.message.replace(/https?:\/\/[^\s]+/g,'[URL]');process.exitCode=1;}
 finally {fs.writeFileSync('artifacts/stages/media-stage5c-evidence/large-upload.json',JSON.stringify(result,null,2));console.log(result);}
})();
