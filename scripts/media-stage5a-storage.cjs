// Real private storage checks. Signed URLs and JWTs remain in process memory.
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const api='http://127.0.0.1:18081/api';
const headers=token=>({Authorization:'Bearer '+token});
const json={'Content-Type':'application/json'};
exports.shortUrl=(url,method='GET',ttl=2)=>{
 const env=JSON.parse(execFileSync('docker',['inspect','zvonok-backend','--format','{{json .Config.Env}}'],{encoding:'utf8'}));
 const cfg=Object.fromEntries(env.map(x=>{const i=x.indexOf('=');return [x.slice(0,i),x.slice(i+1)];}));
 const enc=s=>encodeURIComponent(s).replace(/[!'()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase());
 const hash=x=>crypto.createHash('sha256').update(x).digest('hex'),hmac=(k,x)=>crypto.createHmac('sha256',k).update(x).digest();
 const target=new URL(url);assert.ok(target.searchParams.has('X-Amz-Signature'),'SigV4 expected');
 target.searchParams.delete('X-Amz-Signature');target.searchParams.set('X-Amz-Expires',String(ttl));
 const credential=target.searchParams.get('X-Amz-Credential').split('/'),scope=credential.slice(1).join('/');
 const query=[...target.searchParams].map(([k,v])=>[enc(k),enc(v)]).sort(([a,av],[b,bv])=>a<b?-1:a>b?1:av<bv?-1:av>bv?1:0).map(([k,v])=>k+'='+v).join('&');
 const canonical=[method,target.pathname,query,'host:'+target.host+'\n','host','UNSIGNED-PAYLOAD'].join('\n');
 const signing=hmac(hmac(hmac(hmac('AWS4'+cfg.S3_SECRET_ACCESS_KEY,credential[1]),credential[2]),credential[3]),credential[4]);
 target.searchParams.set('X-Amz-Signature',crypto.createHmac('sha256',signing).update('AWS4-HMAC-SHA256\n'+target.searchParams.get('X-Amz-Date')+'\n'+scope+'\n'+hash(canonical)).digest('hex'));
 return target.toString();
};
exports.fixture=async(file='clip.webm', mime='video/webm')=>{
 async function user(){const name='media5a'+Date.now()+crypto.randomBytes(3).toString('hex'),password=crypto.randomUUID()+'aA1!';const r=await fetch(api+'/auth/register',{method:'POST',headers:json,body:JSON.stringify({username:name,email:name+'@test.invalid',password})});assert.equal(r.status,201);return {name,password,...await r.json()};}
 const owner=await user(),outsider=await user();
 const roomResponse=await fetch(api+'/rooms/createGroup',{method:'POST',headers:{...json,...headers(owner.accessToken)},body:JSON.stringify({roomName:'Stage5A private storage acceptance',roomMemberUsernames:[]})});assert.equal(roomResponse.status,201);
 const room=await roomResponse.json(),form=new FormData();form.set('clientRequestId',crypto.randomUUID());
 form.set('attachmentType','VIDEO');form.set('files',new Blob([fs.readFileSync('artifacts/stages/media-stage5a-evidence/'+file)],{type:mime}),file);
 const upload=await fetch(api+`/rooms/${room.id}/messages/attachments`,{method:'POST',headers:headers(owner.accessToken),body:form});assert.equal(upload.status,200);
 const attachment=(await upload.json()).attachments[0];
 const grant=await fetch(api+`/message-attachments/${attachment.id}/playback-access`,{method:'POST',headers:headers(owner.accessToken)});assert.equal(grant.status,200);
 assert.equal(grant.headers.get('cache-control'),'no-store');const descriptor=await grant.json();
 return {owner,outsider,room,attachment,descriptor};
};
if(require.main===module)(async()=>{
 const {owner,outsider,room,attachment,descriptor}=await exports.fixture(),result={};
 result.https=new URL(descriptor.url).protocol==='https:';assert.ok(result.https);
 result.ttlSeconds=Math.round((Date.parse(descriptor.expiresAt)-Date.now())/1000);assert.ok(result.ttlSeconds>890&&result.ttlSeconds<=900);
 const range=await fetch(descriptor.url,{headers:{Range:'bytes=1000-1999',Origin:'http://localhost:3001'}});
 result.range={status:range.status,contentRange:range.headers.get('content-range'),bytes:(await range.arrayBuffer()).byteLength,cors:range.headers.get('access-control-allow-origin')};
 assert.equal(range.status,206);assert.equal(result.range.bytes,1000);
 const invalid=await fetch(descriptor.url,{headers:{Range:`bytes=${attachment.sizeBytes+1}-`}});result.invalidRange=invalid.status;assert.equal(invalid.status,416);
 const head=await fetch(descriptor.url,{method:'HEAD'});result.headWithGetSignature=head.status;
 const signedHead=await fetch(exports.shortUrl(descriptor.url,'HEAD',60),{method:'HEAD'});result.headWithHeadSignature=signedHead.status;assert.equal(signedHead.status,200);
 const raw=new URL(descriptor.url);raw.search='';const anon=await fetch(raw);result.anonymous=anon.status;assert.equal(anon.status,403);
 for(const [name,token] of [['outsider',outsider.accessToken],['anonymous',null]]){
  const r=await fetch(api+`/message-attachments/${attachment.id}/playback-access`,{method:'POST',headers:token?headers(token):{}});result[name+'Grant']=r.status;assert.ok([401,403,404].includes(r.status));
 }
 const short=exports.shortUrl(descriptor.url);
 const valid=await fetch(short,{headers:{Range:'bytes=0-99'}});assert.equal(valid.status,206);await valid.arrayBuffer();
 await new Promise(r=>setTimeout(r,4000));
 const expired=await fetch(short,{headers:{Range:'bytes=100-199'}});result.expired=expired.status;assert.equal(expired.status,403);
 const left=await fetch(api+`/rooms/${room.id}/leave`,{method:'POST',headers:headers(owner.accessToken)});assert.equal(left.status,204);
 const denied=await fetch(api+`/message-attachments/${attachment.id}/playback-access`,{method:'POST',headers:headers(owner.accessToken)});result.removedMemberGrant=denied.status;assert.ok([403,404].includes(denied.status));
 const still=await fetch(descriptor.url,{headers:{Range:'bytes=0-99'}});result.previousGrantAfterLeave=still.status;assert.equal(still.status,206);await still.arrayBuffer();
 fs.writeFileSync('artifacts/stages/media-stage5a-evidence/storage.json',JSON.stringify({status:'PASS',...result},null,2));console.log(result);
})().catch(e=>{console.error(e.message.replace(/https?:\/\/[^\s]+/g,'[URL]'));process.exitCode=1;});

