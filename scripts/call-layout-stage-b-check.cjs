const {chromium}=require(process.env.STAGE10_PLAYWRIGHT || 'C:/Users/Пользователь/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict'); const fs=require('node:fs');
const output=process.env.STAGE_B_OUTPUT || 'artifacts/stages/call-layout-stage-b-evidence';fs.mkdirSync(output,{recursive:true});
(async()=>{const browser=await chromium.launch({headless:true}); let page=await browser.newPage(); const results=[]; const errors=[];page.on('pageerror',e=>errors.push(e.message));
try {
for(const [w,h] of [[1920,1080],[1440,900],[1366,768],[1024,768],[1024,600],[1000,700]]) {
 for(const count of [1,2,3,4,8,12]) {
  await page.close();page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:w,height:h});await page.goto(`http://127.0.0.1:3017/scripts/call-layout-preview.html?stageB&voice&count=${count}`);
  await page.locator('[data-call-dock]').waitFor();
  const dock=await page.locator('[data-call-dock]').boundingBox();assert(dock.x>=0&&dock.y>=0&&dock.x+dock.width<=w&&dock.y+dock.height<=h);
  await page.getByRole('button',{name:'Развернуть',exact:true}).click();await page.locator('[data-layout="voice"]').waitFor();await page.waitForTimeout(100);
  const m=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,avatars:[...document.querySelectorAll('[data-voice-count] img,[data-voice-count] [class*="avatar-fallback"]')].map(e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height})), controls:(()=>{const r=document.querySelector('[aria-label="Управление звонком"]').getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom};})(),cards:document.querySelectorAll('[data-voice-count] [data-card-id]').length}));
  assert(!m.overflow);assert.equal(m.cards,count);assert(m.avatars.every(a=>a.width>0&&a.width<=128&&a.height<=128));assert(m.controls.bottom<=h+1&&m.controls.right<=w+1);
  results.push({viewport:[w,h],count,status:'PASS',dock,...m});
 }
}
await page.goto('http://127.0.0.1:3017/scripts/call-layout-preview.html?stageB&voice&count=4');await page.locator('[data-call-dock]').waitFor();
await page.evaluate(()=>window.stageFixture.camera(true)); await page.getByRole('button',{name:'Смотреть видео',exact:true}).waitFor();assert(await page.locator('[data-call-dock]').isVisible());
await page.getByRole('button',{name:'Развернуть',exact:true}).click();assert(await page.locator('[data-layout="voice"]').isVisible());
const ids=await page.locator('[data-voice-count] [data-card-id]').evaluateAll(ns=>{window.savedCards=ns;return ns.map(n=>n.dataset.cardId)});
await page.evaluate(()=>window.stageFixture.speak());assert(await page.evaluate(()=>window.savedCards.every(n=>n.isConnected)));
await page.evaluate(()=>window.stageFixture.share());await page.waitForTimeout(100);assert(await page.locator('[data-layout="voice"]').isVisible());
assert.deepEqual(await page.locator('[data-voice-count] [data-card-id]').evaluateAll(ns=>ns.map(n=>n.dataset.cardId)),ids);
await page.getByRole('button',{name:'Свернуть звонок',exact:true}).click();await page.getByRole('button',{name:'Смотреть трансляцию',exact:true}).click();await page.locator('[data-layout="screen"]').waitFor();
await page.getByRole('button',{name:'Сетка',exact:true}).click();await page.locator('[data-layout="grid"]').waitFor();
await page.getByRole('button',{name:'Голос',exact:true}).click();await page.getByRole('button',{name:'Переписка звонка',exact:true}).click();await page.waitForTimeout(150);await page.screenshot({path:output+'/stage-b-voice-chat.png'});
await page.getByRole('button',{name:'Свернуть звонок',exact:true}).click();
const handle=page.getByRole('button',{name:'Переместить панель звонка'});const box=await handle.boundingBox();await page.mouse.move(box.x+15,box.y+8);await page.mouse.down();await page.mouse.move(1000,580);await page.mouse.up();await page.setViewportSize({width:800,height:500});await page.waitForTimeout(150);
let d=await page.locator('[data-call-dock]').boundingBox();assert(d.x>=0&&d.y>=0&&d.x+d.width<=800&&d.y+d.height<=500);await page.screenshot({path:output+'/stage-b-compact.png'});
assert.deepEqual(await page.evaluate(()=>window.stageFixture.counts()),{connections:0,publications:0});
results.push({name:'camera/share/manual Voice/slots/restore/drag/resize',status:'PASS'});
await page.close(); page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
await page.setViewportSize({width:1024,height:768});await page.goto('http://127.0.0.1:3017/scripts/call-layout-preview.html?stageB&count=4');
await page.locator('[data-layout="grid"]').waitFor();await page.waitForFunction(()=>[...document.querySelectorAll('video')].every(v=>v.readyState>=2));
assert.equal(await page.locator('[data-call-dock]:not([hidden])').count(),0);
await page.evaluate(()=>window.savedVideos=[...document.querySelectorAll('video')]);
await page.getByRole('button',{name:'Свернуть звонок',exact:true}).click();await page.locator('[data-call-dock]').waitFor();
assert(await page.evaluate(()=>window.savedVideos.every(v=>v.isConnected)));
await page.getByRole('button',{name:'Развернуть',exact:true}).click();await page.locator('[data-layout="grid"]').waitFor();
assert(await page.evaluate(()=>window.savedVideos.every(v=>v.isConnected&&v.videoWidth>0&&v.readyState>=2)));
results.push({name:'camera initial expanded + Compact retains video DOM and canvas frames',status:'PASS'});
assert.deepEqual(errors,[]);console.log('PASS',results.length,'browser checks');
}catch(e){console.error(e);process.exitCode=1;results.push({status:'FAIL',message:String(e)});await page.screenshot({path:output+'/stage-b-failure.png'});}finally{fs.writeFileSync(output+'/stage-b-browser-results.json',JSON.stringify({results,errors,realMedia:'NOT RUN'},null,2));await browser.close();}})();
