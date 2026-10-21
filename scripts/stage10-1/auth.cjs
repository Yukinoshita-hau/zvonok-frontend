const c=require('./common.cjs'),assert=require('node:assert/strict');
(async()=>{const b=await c.browser(),r=c.runner('auth-results.json');const suffix=Date.now().toString(36);let a,other,oldRoom;
try{
await r.run('real browser access JWT expiry and cookie refresh',async()=>{
 const ctx=await b.newContext(),p=await ctx.newPage();await p.goto(c.BASE+'/auth/login');
 const initial=await p.evaluate(async({API,name})=>{const r=await fetch(API+'/auth/register',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:name,email:name+'@test.invalid',password:'Stage10-only-pass!'})});const data=await r.json();window.__rawToken=data.accessToken;const payload=JSON.parse(atob(data.accessToken.split('.')[1]));return {status:r.status,expiresAt:payload.exp*1000,ttl:data.expiresIn};},{API:c.API,name:'s101expiry'+suffix});assert.equal(initial.status,201);assert.ok(initial.ttl<=15000);
 await new Promise(resolve=>setTimeout(resolve,Math.max(0,initial.expiresAt-Date.now()+1200)));
 const result=await p.evaluate(async API=>{const old=await fetch(API+'/auth/me',{headers:{Authorization:'Bearer '+window.__rawToken},credentials:'include'});const refresh=await fetch(API+'/auth/refresh',{method:'POST',credentials:'include'});const d=await refresh.json();const now=await fetch(API+'/auth/me',{headers:{Authorization:'Bearer '+d.accessToken},credentials:'include'});return {oldStatus:old.status,refreshStatus:refresh.status,newStatus:now.status,changed:d.accessToken!==window.__rawToken};},c.API);assert.deepEqual(result,{oldStatus:401,refreshStatus:200,newStatus:200,changed:true});assert.ok((await ctx.cookies(c.API+'/auth/refresh')).some(x=>x.name==='refreshToken'&&x.httpOnly));await ctx.close();return {...result,ttlMs:initial.ttl};
});
a=await c.register(b,'s101autha'+suffix);other=await c.register(b,'s101authb'+suffix);
await r.run('ten concurrent application refresh callers use one real cookie rotation',async()=>{
 const before=a.responses.filter(x=>x.path==='/api/auth/refresh').length;
 const result=await a.page.evaluate(async()=>{const {session}=await import('/src/api/api.ts');const rs=await Promise.all(Array.from({length:10},()=>session.refresh()));return {count:rs.length,distinctTokens:new Set(rs.map(r=>r.data.accessToken)).size,statuses:rs.map(r=>r.status)};});assert.equal(result.count,10);assert.equal(result.distinctTokens,1);assert.ok(result.statuses.every(x=>x===200));assert.equal(a.responses.filter(x=>x.path==='/api/auth/refresh').length-before,1);return {callers:10,networkRefresh:1,activeRefreshRows:Number(c.sql(`select count(*) from refresh_token t join "user" u on u.id=t.user_id where u.username='${a.name}' and not t.revoked`))};
});
await r.run('ten parallel protected HTTP requests remain authorized across refresh',async()=>{
 await new Promise(resolve=>setTimeout(resolve,8000));
 await a.page.evaluate(async()=>{const {api}=await import('/src/api/api.ts');await Promise.all(Array.from({length:10},()=>api.get('/users/my')));});
 return {requests:10,serverExpiryProvedSeparately:true};
});
await r.run('two tabs share real cookie jar and serialize refresh using browser locks',async()=>{
 const tab=await a.context.newPage();await tab.goto(c.BASE);await c.until(async()=>tab.evaluate(async()=> (await import('/src/store/store.ts')).store.getState().user.myUser?.username),15000);
 const execute=p=>p.evaluate(async()=>{const {session}=await import('/src/api/api.ts');return (await session.refresh()).status;});const statuses=await Promise.all([execute(a.page),execute(tab)]);assert.deepEqual(statuses,[200,200]);const me=await tab.evaluate(async()=> (await import('/src/api/api.ts')).api.get('/users/my').then(r=>r.data.username));assert.equal(me,a.name);await tab.close();return {statuses,activeRows:Number(c.sql(`select count(*) from refresh_token t join "user" u on u.id=t.user_id where u.username='${a.name}' and not t.revoked`))};
});
await r.run('logout during pending real refresh cannot resurrect old account',async()=>{
 oldRoom=await c.http(a,'/rooms/createGroup','POST',{roomName:'stage101 private '+suffix,roomMemberUsernames:[]});
 await a.page.evaluate(async()=>{const {store}=await import('/src/store/store.ts');const {fetchMyRooms}=await import('/src/store/slices/room.slice.ts');await store.dispatch(fetchMyRooms());});assert.ok((await c.state(a)).rooms.some(x=>x.id===oldRoom.id));
 let artifacts/stages/release,seen;const gate=new Promise(resolve=>artifacts/stages/release=resolve),arrived=new Promise(resolve=>seen=resolve);
 await a.page.route(c.API+'/auth/refresh',async route=>{const response=await route.fetch();seen();await gate;await route.fulfill({response});});
 const refresh=a.page.evaluate(async()=>{try{await (await import('/src/api/api.ts')).session.refresh();return 'applied';}catch{return 'cancelled';}});
 await arrived;
 const logout=a.page.evaluate(async()=>{const {store}=await import('/src/store/store.ts');const {logoutUser}=await import('/src/store/slices/user.slice.ts');return (await store.dispatch(logoutUser({allDevices:false}))).meta.requestStatus;});
 await c.until(async()=>!(await c.state(a)).user);artifacts/stages/release();assert.equal(await refresh,'cancelled');assert.equal(await logout,'fulfilled');await a.page.unroute(c.API+'/auth/refresh');assert.equal((await c.state(a)).user,undefined);await a.page.reload();await a.page.waitForURL('**/auth/login');return {refresh:'cancelled',logout:'fulfilled',reload:'login'};
});
await r.run('account switch resets Redux scope and old STOMP subscriptions',async()=>{
 await a.page.locator('[name=usernameOrEmail]').fill(other.name);await a.page.locator('[name=password]').fill('Stage10-only-pass!');await a.page.locator('form button').click();await a.page.waitForURL(c.BASE+'/');await c.ready(a);await c.until(async()=> (await c.state(a)).user===other.name);assert.ok(!(await c.state(a)).rooms.some(x=>x.id===oldRoom.id));
 const identities=await a.page.evaluate(()=>window.__sockets.filter(s=>s.url.includes(':18080/')&&s.readyState===1).map(s=>{const t=new URL(s.url).searchParams.get('token');return JSON.parse(atob(t.split('.')[1])).sub;}));assert.deepEqual(identities,[other.name]);const s=await c.state(a);assert.equal(s.messages.length,0);return {newAccount:other.name,connectedIdentities:identities,oldMessages:0};
});
await r.run('revoked and invalid refresh cookies deterministically terminate browser session',async()=>{
 const live=await b.newContext();const reg=await live.request.post(c.API+'/auth/register',{data:{username:'s101rev'+suffix,email:'s101rev'+suffix+'@test.invalid',password:'Stage10-only-pass!'}});assert.equal(reg.status(),201);const old=(await live.cookies()).find(x=>x.name==='refreshToken');const refreshed=await live.request.post(c.API+'/auth/refresh');assert.equal(refreshed.status(),200);
 const outcomes=[];for(const value of [old.value,'stage10-1-invalid-cookie']){const ctx=await b.newContext();await ctx.addCookies([{...old,value}]);const page=await ctx.newPage();const statuses=[];page.on('response',r=>{if(r.url()===c.API+'/auth/refresh')statuses.push(r.status());});await page.goto(c.BASE);await page.waitForURL('**/auth/login');assert.ok(statuses.includes(401));outcomes.push({refreshStatus:401,redirect:'login'});await ctx.close();}await live.close();return {outcomes};
});
}finally{await b.close();}if(r.results.some(x=>x.status==='FAIL'))process.exitCode=1;
})().catch(e=>{console.error(c.redact(e.stack));process.exitCode=1;});
