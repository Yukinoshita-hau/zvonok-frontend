// Diagnostic accounts only; never print credentials or storage URLs.
const fs = require('node:fs'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const api = process.env.CORE_API || 'http://localhost:8080/api';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jv1kAAAAASUVORK5CYII=', 'base64');
(async () => {
  const name = 'coreprobe' + Date.now();
  const registration = await fetch(api + '/auth/register', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({username:name,email:name+'@test.invalid',password:crypto.randomUUID()+'aA1!'})});
  if (registration.status !== 201) throw Error('registration status '+registration.status);
  const {accessToken} = await registration.json();
  const headers = {Authorization:'Bearer '+accessToken};
  const group = await fetch(api + '/rooms/createGroup', {method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({roomName:'Core storage diagnostic',roomMemberUsernames:[]})});
  if (!group.ok) throw Error('group status '+group.status);
  const room = await group.json(), form = new FormData();
  form.set('clientRequestId',crypto.randomUUID()); form.set('attachmentType','IMAGE');
  form.set('files',new Blob([png],{type:'image/png'}),'probe.png');
  const upload = await fetch(api+`/rooms/${room.id}/messages/attachments`, {method:'POST',headers,body:form});
  const text = await upload.text();
  const safe = text.replace(/https?:\/\/[^\s"<>]+/g,'[URL]').replace(/eyJ[\w.-]+/g,'[JWT]');
  const result = {registration:registration.status,group:group.status,roomId:room.id,upload:upload.status,response:safe};
  if (upload.ok) {
    const message = JSON.parse(text), attachment = message.attachments[0];
    assert.ok(attachment?.id, 'attachment reference');
    const retry = await fetch(api+`/rooms/${room.id}/messages/attachments`, {method:'POST',headers,body:form});
    assert.equal(retry.status,200);assert.equal((await retry.json()).id,message.id);
    const download = await fetch(api+`/message-attachments/${attachment.id}/download`,{headers});
    assert.equal(download.status,200);assert.deepEqual(Buffer.from(await download.arrayBuffer()),png);
    const outsiderName = name+'x';
    const outsider = await fetch(api+'/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:outsiderName,email:outsiderName+'@test.invalid',password:crypto.randomUUID()+'aA1!'})});
    assert.equal(outsider.status,201);
    const outsiderToken = (await outsider.json()).accessToken;
    const denied = await fetch(api+`/message-attachments/${attachment.id}/download`,{headers:{Authorization:'Bearer '+outsiderToken}});
    assert.ok([403,404].includes(denied.status));
    Object.assign(result,{messageId:message.id,attachmentId:attachment.id,retry:retry.status,oneMessage:true,download:download.status,exactBytes:png.length,outsider:denied.status});
    delete result.response;
  } else { process.exitCode=1; }
  fs.writeFileSync(process.env.CORE_STORAGE_PROBE_OUT || 'artifacts/stages/core-final-evidence/main-storage-probe.json',JSON.stringify(result,null,2));
  console.log(result);
})().catch(e=>{console.error(e.message);process.exitCode=1;});
