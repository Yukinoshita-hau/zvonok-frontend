// Real Spring/PostgreSQL/private S3 acceptance. Never persist bearer grants or signed URLs.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const api='http://127.0.0.1:18081/api',out='artifacts/stages/media-stage5b-evidence';
const auth=u=>({Authorization:'Bearer '+u.accessToken});
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
exports.run=async()=>{
 const results=[];
 const record=(scenario,details={})=>{results.push({scenario,status:'PASS',...details});console.log('PASS',scenario);};
 const request=async(u,endpoint,method='GET',data)=>{
  const r=await fetch(api+endpoint,{method,headers:{...auth(u),'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined});
  assert.ok(r.ok,endpoint+': '+r.status); return r.status===204?null:r.json();
 };
 const user=async()=>{const name='stage5b'+Date.now()+crypto.randomBytes(3).toString('hex'),password=crypto.randomUUID()+'aA1!';
  const r=await fetch(api+'/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:name,email:name+'@test.invalid',password})});assert.equal(r.status,201);return {name,password,...await r.json()};};
 const previous=process.argv.includes('--resume')?JSON.parse(fs.readFileSync(path.join(os.tmpdir(),'zvonok-stage5b-runtime.json'))):null;
 const owner=previous?.owner||await user(),outsider=previous?.outsider||await user();
 const room=previous?.room||await request(owner,'/rooms/createGroup','POST',{roomName:'Stage 5B private documents',roomMemberUsernames:[]});
 const upload=async(files,key=crypto.randomUUID(),content='Stage 5B',reply)=>{
  const form=new FormData();form.set('clientRequestId',key);form.set('content',content);if(reply)form.set('replyToMessageId',reply);
  for(const f of files)form.append('files',new Blob([f.bytes],{type:f.mime}),f.name);
  return fetch(api+`/rooms/${room.id}/messages/attachments`,{method:'POST',headers:auth(owner),body:form});
 };
 const fixtures=[];
 for(const [name,mime] of [['pages-1.pdf','application/pdf'],['pages-20.pdf','application/pdf'],['pages-100.pdf','application/pdf'],['pages-500.pdf','application/pdf'],['preview.txt','text/plain'],['preview.md','text/markdown'],['preview.json','application/json'],['preview.csv','text/csv'],['large.txt','text/plain'],['document.docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document'],['archive.zip','application/zip'],['corrupt.pdf','application/pdf']]){
  fixtures.push({name,mime,bytes:fs.readFileSync(out+'/fixtures/'+name)});
 }
 fixtures.push({name:'image.png',mime:'image/png',bytes:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1cAAAAASUVORK5CYII=','base64')});
 fixtures.push({name:'clip.mp4',mime:'video/mp4',bytes:fs.readFileSync(process.env.STAGE5B_MP4 || 'artifacts/stages/media-stage5b-evidence/fixtures/sample.mp4')});
 const attachments=previous?.attachments||[];
 try{
 for(const f of fixtures){
  if(attachments.some(a=>a.originalFileName===f.name))continue;
  const r=await upload([f]);assert.equal(r.status,200,f.name+': '+await r.clone().text());const message=await r.json(),attachment=message.attachments[0];
  assert.equal(attachment.originalFileName,f.name);assert.equal(attachment.contentType,f.mime);assert.equal(attachment.sizeBytes,f.bytes.length);
  const download=await fetch(api+`/message-attachments/${attachment.id}/download`,{headers:auth(owner)});assert.equal(download.status,200);
  assert.equal(hash(Buffer.from(await download.arrayBuffer())),hash(f.bytes));
  assert.ok(download.headers.get('content-disposition').startsWith('attachment;'));
  attachments.push({...attachment,messageId:message.id});record('upload/download original bytes: '+f.name,{attachmentId:attachment.id,bytes:f.bytes.length});
  fs.writeFileSync(path.join(os.tmpdir(),'zvonok-stage5b-runtime.json'),JSON.stringify({owner,outsider,room,attachments}));
 }
 const key=crypto.randomUUID();const duplicate=await Promise.all([upload(fixtures.slice(0,2),key,'text + files',attachments[0].messageId),upload(fixtures.slice(0,2),key,'text + files',attachments[0].messageId)]);
 const messages=await Promise.all(duplicate.map(async r=>{assert.equal(r.status,200);return r.json();}));assert.equal(messages[0].id,messages[1].id);assert.equal(messages[0].attachments.length,2);assert.equal(messages[0].replyToMessageId,attachments[0].messageId);
 record('concurrent idempotent multipart + multiple files + text + reply',{messageId:messages[0].id});
 const pdf=attachments.find(a=>a.originalFileName==='pages-500.pdf');
 const grant=await request(owner,`/message-attachments/${pdf.id}/playback-access`,'POST');
 const range=await fetch(grant.url,{headers:{Range:'bytes=1000-1999',Origin:'http://localhost:3001'}});assert.equal(range.status,206);assert.equal((await range.arrayBuffer()).byteLength,1000);assert.equal(range.headers.get('content-range'),`bytes 1000-1999/${pdf.sizeBytes}`);assert.equal(range.headers.get('access-control-allow-origin'),'http://localhost:3001');
 record('PDF real direct S3 Range',{status:206,contentRange:range.headers.get('content-range'),origin:range.headers.get('access-control-allow-origin')});
 const anonymous=new URL(grant.url);anonymous.search='';assert.equal((await fetch(anonymous)).status,403);record('private S3 anonymous denial');
 for(const a of attachments){const r=await fetch(api+`/message-attachments/${a.id}/download`,{headers:auth(outsider)});assert.ok([403,404].includes(r.status));}
 const denied=await fetch(api+`/message-attachments/${pdf.id}/playback-access`,{method:'POST',headers:auth(outsider)});assert.ok([403,404].includes(denied.status));record('outsider download and access denial');
 for(const f of [{name:'bad.pdf',mime:'application/pdf',bytes:Buffer.from('<html>evil</html>')},{name:'bad.svg',mime:'image/svg+xml',bytes:Buffer.from('<svg/>')},{name:'bad.txt',mime:'text/plain',bytes:Buffer.from([255,0])}]){const r=await upload([f]);assert.ok([400,415,422].includes(r.status),f.name+': '+r.status);}
 record('signature, active SVG and invalid UTF-8 rejected');
 const member=await user();const group=await request(member,'/rooms/createGroup','POST',{roomName:'Stage 5B revoke',roomMemberUsernames:[]});
 const form=new FormData();form.set('clientRequestId',crypto.randomUUID());form.set('files',new Blob([fixtures[0].bytes],{type:'application/pdf'}),'revoke.pdf');
 const uploaded=await fetch(api+`/rooms/${group.id}/messages/attachments`,{method:'POST',headers:auth(member),body:form});assert.equal(uploaded.status,200);const revoke=(await uploaded.json()).attachments[0];
 await request(member,`/message-attachments/${revoke.id}/playback-access`,'POST');await request(member,`/rooms/${group.id}/leave`,'POST');
 const revoked=await fetch(api+`/message-attachments/${revoke.id}/playback-access`,{method:'POST',headers:auth(member)});assert.ok([403,404].includes(revoked.status));record('removed GROUP member cannot renew grant');
 const state={owner,outsider,room,attachments};fs.writeFileSync(path.join(os.tmpdir(),'zvonok-stage5b-runtime.json'),JSON.stringify(state));
 fs.writeFileSync(out+'/storage.json',JSON.stringify({status:'PASS',results},null,2));return state;
 }catch(error){fs.writeFileSync(out+'/storage.json',JSON.stringify({status:'FAIL',results,error:error.message.replace(/https?:\/\/[^\s]+/g,'[URL]')},null,2));throw error;}
};
if(require.main===module)exports.run().catch(e=>{console.error(e.message.replace(/https?:\/\/[^\s]+/g,'[URL]'));process.exitCode=1;});
