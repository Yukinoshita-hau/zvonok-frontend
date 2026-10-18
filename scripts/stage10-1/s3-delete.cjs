const c=require('./common.cjs'),s=require('./s3-client.cjs'),assert=require('node:assert/strict');
(async()=>{const b=await c.browser(),r=c.runner('s3-delete-results.json');let trigger=false;try{
const u=await c.register(b,'s101delete'+Date.now().toString(36));
await r.run('persistent S3 DELETE outage during database rollback leaves no new orphan',async()=>{
 const before=await s.keys();const original=c.sql(`select coalesce(avatar_url,'') from "user" where username='${u.name}'`);
 c.sql(`create function stage101_delete_failure() returns trigger language plpgsql as $$ begin if NEW.username='${u.name}' and NEW.avatar_url is distinct from OLD.avatar_url then raise exception 'stage101 DELETE fault rollback'; end if; return NEW; end $$; create trigger stage101_delete_failure before update on "user" for each row execute function stage101_delete_failure()`);trigger=true;
 let created=[];try{
 await s.fault({method:'DELETE',path:'avatar_'});
 const response=await u.page.request.post(c.API+'/users/upload-avatar',{headers:{Authorization:'Bearer '+await c.token(u)},multipart:{file:{name:'fault.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jv1kAAAAASUVORK5CYII=','base64')}}});
 assert.ok(response.status()>=500);created=(await s.keys()).filter(k=>!before.includes(k));assert.equal(c.sql(`select coalesce(avatar_url,'') from "user" where username='${u.name}'`),original);
 const operations=await (await fetch('http://127.0.0.1:19002')).json();c.save('s3-delete-outage-observation.json',{backendStatus:response.status(),newOrphans:created,deleteFailures:operations.operations.filter(v=>v.method==='DELETE'&&v.injected),recovery:'only newly created and SQL-unreferenced acceptance keys removed after fault reset'});
 }finally{
 await s.fault(null);
 for(const key of created){const referenced=c.sql(`select count(*) from "user" where avatar_url like '%/${key}'`);assert.equal(referenced,'0');assert.ok((await s.s3('DELETE',key)).ok);}
 c.sql('drop trigger stage101_delete_failure on "user"; drop function stage101_delete_failure()');trigger=false;
 }
 assert.equal(created.length,0,'persistent S3 DELETE outage leaves an orphan; durable retry/reconciliation requires a separate infrastructure/schema plan');
});
}finally{await s.fault(null);if(trigger)c.sql('drop trigger stage101_delete_failure on "user"; drop function stage101_delete_failure()');await b.close();}if(r.results.some(v=>v.status==='FAIL'))process.exitCode=1;})().catch(e=>{console.error(c.redact(e.stack));process.exitCode=1;});
