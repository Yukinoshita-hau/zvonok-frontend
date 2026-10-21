const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const api='http://127.0.0.1:18081/api',file=path.join(os.tmpdir(),'zvonok-stage5c-runtime.json'),out='artifacts/stages/media-stage5c-evidence';
const state=JSON.parse(fs.readFileSync(file)),results=[];
const auth=u=>({Authorization:'Bearer '+u.accessToken});
const record=(scenario,details={})=>{results.push({status:'PASS',scenario,...details});console.log('PASS',scenario);};
async function req(u,url,options={}){return fetch(api+url,{...options,headers:{...auth(u),...options.headers}});}
async function json(u,url,options){const r=await req(u,url,options);assert.ok(r.ok,url+': '+r.status);return r.json();}
(async()=>{
 try {
 for(const u of [state.owner,state.outside||state.outsider]) {Object.assign(u,await json(u,'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({usernameOrEmail:u.name,password:u.password})}));}
 if(!state.libraryRoom){state.libraryRoom=await json(state.owner,'/rooms/createGroup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({roomName:'Stage 5C diagnostic library',roomMemberUsernames:[]})});fs.writeFileSync(file,JSON.stringify(state));}
 const room=state.libraryRoom.id;
 const first=await json(state.owner,`/rooms/${state.room.id}/attachments?limit=3`);assert.equal(first.items.length,3);assert.ok(first.nextCursor);
 const second=await json(state.owner,`/rooms/${state.room.id}/attachments?limit=3&cursor=${first.nextCursor}`);
 assert.ok(second.items.every(i=>!first.items.some(j=>i.attachment.id===j.attachment.id)));record('real PostgreSQL cursor pagination');
 for(const [url,status] of [[`/rooms/${state.room.id}/attachments?cursor=invalid`,400],[`/rooms/${state.room.id}/attachments?category=document&cursor=${first.nextCursor}`,400],[`/rooms/${room}/attachments?cursor=${first.nextCursor}`,400],[`/rooms/${state.room.id}/attachments?limit=61`,400],[`/rooms/${state.room.id}/attachments?filenameQuery=${'a'.repeat(129)}`,400]])assert.equal((await req(state.owner,url)).status,status,url);
 record('malformed, foreign-room, filter-mismatched cursor and bounds rejected');
 for(const suffix of ['/attachments','/attachments?filenameQuery=pdf',`/messages/${first.items[0].messageId}/context`])assert.ok([403,404].includes((await req(state.outsider,`/rooms/${state.room.id}${suffix}`)).status));
 assert.equal((await fetch(api+`/rooms/${room}/attachments`)).status,401);record('anonymous and outsider metadata/search/context denied');
 const context=await json(state.owner,`/rooms/${state.room.id}/messages/${first.items[0].messageId}/context`);assert.ok(context.length<=31);assert.ok(context.some(m=>m.id===first.items[0].messageId));
 assert.equal((await req(state.owner,`/rooms/${room}/messages/${first.items[0].messageId}/context`)).status,404);record('bounded authorized context and cross-room jump denied');
 for(const query of ["' OR 1=1 --",'%','_','不存在']) {const page=await json(state.owner,`/rooms/${state.room.id}/attachments?filenameQuery=${encodeURIComponent(query)}`);assert.equal(page.items.length,0);}
 const search=await json(state.owner,`/rooms/${state.room.id}/attachments?filenameQuery=PDF&category=document`);assert.ok(search.items.length);assert.ok(search.items.every(i=>i.attachment.originalFileName.toLowerCase().includes('pdf')));
 const payload=JSON.stringify(search);assert.ok(!/storageKey|X-Amz|accessToken|password|email/.test(payload));assert.ok(search.items.every(i=>!i.attachment.url&&!i.attachment.downloadUrl));record('literal case-insensitive backend search, SQL injection and private fields');
 // Group membership loss is tested on a fresh diagnostic group, never an existing user room.
 const leaveRoom=await json(state.owner,'/rooms/createGroup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({roomName:'Stage 5C revoke',roomMemberUsernames:[]})});
 await json(state.owner,`/rooms/${leaveRoom.id}/attachments`);assert.equal((await req(state.owner,`/rooms/${leaveRoom.id}/leave`,{method:'POST'})).status,204);
 assert.ok([403,404].includes((await req(state.owner,`/rooms/${leaveRoom.id}/attachments`)).status));record('membership loss denies new library requests');
 fs.writeFileSync(file,JSON.stringify(state));
 } catch(e) {results.push({status:'FAIL',error:e.message});process.exitCode=1;console.error(e.message);}
 finally {fs.mkdirSync(out,{recursive:true});fs.writeFileSync(out+'/api-results.json',JSON.stringify(results,null,2));}
})();
