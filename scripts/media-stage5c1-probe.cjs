const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const file=path.join(os.tmpdir(),'zvonok-stage5c-runtime.json'),out='artifacts/stages/media-stage5c1-evidence';fs.mkdirSync(out,{recursive:true});
(async()=>{const state=JSON.parse(fs.readFileSync(file)),api='http://127.0.0.1:18081/api',results=[];
 const login=await fetch(api+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({usernameOrEmail:state.owner.name,password:state.owner.password})});if(!login.ok)throw Error('login '+login.status);Object.assign(state.owner,await login.json());fs.writeFileSync(file,JSON.stringify(state));
 const sample=fs.readFileSync('artifacts/stages/media-stage5b-evidence/fixtures/sample.mp4');
 const sizes=process.argv.includes('--large')?[25545779]:process.argv.includes('--medium')?[5242880]:[sample.length,1048576];
 for(const size of sizes){let bytes;if(size===25545779)bytes=fs.readFileSync('artifacts/stages/media-stage5a-evidence/progressive.mp4');else if(size===sample.length)bytes=sample;else{const free=Buffer.alloc(size-sample.length);free.writeUInt32BE(free.length);free.write('free',4);bytes=Buffer.concat([sample,free]);}
  const key=crypto.randomUUID(),form=new FormData();form.set('clientRequestId',key);form.set('content','Stage 5C.1 upload diagnostics');form.set('files',new Blob([bytes],{type:'video/mp4'}),'stage5c1-'+size+'.mp4');
  const start=Date.now(),r=await fetch(api+`/rooms/${state.libraryRoom.id}/messages/attachments`,{method:'POST',headers:{Authorization:'Bearer '+state.owner.accessToken},body:form});let body=await r.json();const item={bytes:size,httpStatus:r.status,elapsedMs:Date.now()-start,trace:r.headers.get('x-upload-trace'),committed:!!body.id,error:r.ok?null:body.message?.replace(/https?:\/\/\S+/g,'[URL]')};
  if(r.ok){item.messageId=body.id;item.attachmentId=body.attachments[0].id;item.sha256=crypto.createHash('sha256').update(bytes).digest('hex');}
  results.push(item);console.log(item);fs.writeFileSync(out+'/'+(process.argv.includes('--large')?'large-probe':process.argv.includes('--medium')?'medium-probe':'size-probes')+'.json',JSON.stringify(results,null,2));
  if(!r.ok){process.exitCode=1;break;}
 }
})().catch(e=>{console.error(e.message);process.exitCode=1;});
