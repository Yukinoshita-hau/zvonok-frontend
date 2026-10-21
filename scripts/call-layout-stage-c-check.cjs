const {chromium}=require(process.env.STAGE10_PLAYWRIGHT || 'C:/Users/Пользователь/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'), assert=require('node:assert/strict');
const out='artifacts/stages/call-layout-stage-c-evidence';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true});const page=await browser.newPage();const results=[],errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const record=(name,detail={})=>{results.push({name,status:'PASS',...detail});console.log('PASS',name);};
 const shot=async name=>{await page.waitForTimeout(250);return page.screenshot({path:`${out}/${name}.png`});};
 const open=async(count=2,w=1440,h=900)=>{await page.setViewportSize({width:w,height:h});await page.goto(`http://127.0.0.1:3017/scripts/call-layout-preview.html?count=${count}&fps30&b1`);await page.locator('[data-layout="grid"]').waitFor();};
 const share=async(index=0,ratio=16/9)=>{await page.evaluate(({index,ratio})=>window.stageFixture.share(index,ratio),{index,ratio});};
 const content=()=>page.locator('[data-content-view]');
 const primary=()=>page.locator('[data-content-source]').first();
 const sourceCount=()=>page.locator('[data-content-source]').count();
 const checkGeometry=async()=>{
  await page.waitForTimeout(160);
  const m=await page.evaluate(()=>{
   const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
   return {overflow:document.documentElement.scrollWidth>innerWidth,controls:rect(document.querySelector('[aria-label="Управление звонком"]')),content:rect(document.querySelector('[data-content-view]')),sources:[...document.querySelectorAll('[data-content-source]')].map(rect), videos:[...document.querySelectorAll('[data-content-source] video')].map(v=>({readyState:v.readyState,width:v.videoWidth,height:v.videoHeight,fit:getComputedStyle(v).objectFit,rect:rect(v),viewport:rect(v.closest('[data-content-source]').querySelector('[data-zoom]'))})), audio:document.querySelectorAll('audio').length};
  });
  assert(!m.overflow);assert(m.controls.bottom<=page.viewportSize().height+1);assert(m.sources.every(r=>r.width>40&&r.height>40&&r.bottom<=m.controls.y+1));
  assert(m.videos.every(v=>v.fit==='contain'&&v.rect.x>=v.viewport.x-1&&v.rect.right<=v.viewport.right+1&&v.rect.y>=v.viewport.y-1&&v.rect.bottom<=v.viewport.bottom+1));assert.equal(m.audio,0);return m;
 };
 try{
  await open();await share();await content().waitFor();assert.equal(await primary().getAttribute('data-content-source'),'screen:TR_SCREEN');await shot('content-screen-strip');
  record('Auto promotes screen; person strip is unique',await checkGeometry());
  assert.equal(await page.locator('[aria-label="Участники звонка"] [data-card-id]').count(),2);
  await page.waitForFunction(()=>document.querySelector('[data-content-source] video')?.readyState>=2);
  await page.evaluate(()=>{window.primaryVideo=document.querySelector('[data-content-source] video');window.roomBefore=window.stageFixture.room;window.callBefore=window.stageFixture.view();});
  await page.evaluate(()=>{window.longTasks=[];window.perfObserver=new PerformanceObserver(l=>window.longTasks.push(...l.getEntries().map(e=>e.duration)));window.perfObserver.observe({type:'longtask',buffered:false});});
  await page.getByRole('combobox',{name:'Смотреть',exact:true}).focus();await page.keyboard.press('Space');await shot('source-picker');await page.keyboard.press('Escape');
  assert(await page.evaluate(()=>window.primaryVideo===document.querySelector('[data-content-source] video')));record('native source picker keyboard open/escape retains video');
  await page.getByRole('button',{name:'Split',exact:true}).click();assert.equal(await sourceCount(),2);
  await page.getByRole('combobox',{name:'Расположение Split'}).selectOption('side');await shot('split-50-50-screen-camera');
  const divider=page.getByRole('separator',{name:'Размер областей Split'});await divider.focus();
  for(let i=0;i<8;i++)await page.keyboard.press('ArrowRight');assert.equal(await divider.getAttribute('aria-valuenow'),'70');await shot('split-70-30');
  assert(await page.evaluate(()=>window.primaryVideo===document.querySelector('[data-content-source] video')));
  await divider.dblclick();assert.equal(await divider.getAttribute('aria-valuenow'),'50');
  const box=await divider.boundingBox();await page.mouse.move(box.x+5,box.y+20);await page.mouse.down();await page.mouse.move(4000,box.y+20,{steps:4});await page.mouse.up();assert.equal(await divider.getAttribute('aria-valuenow'),'70');
  await divider.focus();await page.keyboard.press('Home');assert.equal(await divider.getAttribute('aria-valuenow'),'50');
  await page.getByRole('combobox',{name:'Расположение Split'}).selectOption('stacked');await divider.focus();assert.equal(await divider.getAttribute('aria-orientation'),'horizontal');await page.keyboard.press('ArrowDown');assert.equal(await divider.getAttribute('aria-valuenow'),'55');record('Split horizontal/vertical, pointer clamp, keyboard/reset preserve primary');
  const firstKey=await primary().getAttribute('data-content-source');assert(await page.getByRole('combobox',{name:'Второй источник'}).locator(`option[value='${firstKey}']`).evaluate(o=>o.disabled));
  await page.getByRole('button',{name:'Split',exact:true}).click();assert.equal(await sourceCount(),1);assert(await page.evaluate(()=>window.primaryVideo===document.querySelector('[data-content-source] video')));
  const zoom=page.getByRole('combobox',{name:/Масштаб:/});await zoom.selectOption('150');await shot('zoom-150');
  const viewport=page.locator('[data-zoom="150"]');await viewport.focus();await page.keyboard.press('ArrowRight');
  const transform=await viewport.locator('[class*="surface"]').evaluate(e=>e.style.transform);assert(!transform.includes('+ 0px), calc(-50% + 0px)'));
  await viewport.dblclick();assert.equal(await zoom.inputValue(),'fit');record('native-pixel Zoom 150/pan/double-click Fit');
  await page.getByRole('button',{name:'Скрыть участников'}).click();assert.equal(await page.locator('[aria-label="Участники звонка"]:visible').count(),0);
  await page.getByRole('button',{name:'Кино',exact:true}).click();assert.equal(await sourceCount(),1);assert(await page.evaluate(()=>window.primaryVideo===document.querySelector('[data-content-source] video')));await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Показать участников'}).click();await page.getByRole('button',{name:'Свернуть звонок',exact:true}).first().click();await page.evaluate(()=>window.stageFixture.navigate());
  await page.getByRole('button',{name:'Развернуть',exact:true}).click();await content().waitFor();await shot('compact-to-content');
  assert(await page.evaluate(()=>window.primaryVideo===document.querySelector('[data-content-source] video')&&window.roomBefore===window.stageFixture.room&&window.callBefore.callStartedAtMs===window.stageFixture.view().callStartedAtMs));record('Content/Cinema/Compact/navigation/Expanded retain Room, primary video, timer');
  await page.evaluate(()=>window.stageFixture.reconnect(false));await page.getByRole('status').filter({hasText:'Источник недоступен'}).waitFor();assert.equal(await primary().getAttribute('data-content-source'),'screen:TR_SCREEN');await page.evaluate(()=>window.stageFixture.reconnect(true));record('reconnecting retains source and shows state');
  await page.evaluate(()=>window.stageFixture.camera(false));assert.equal(await primary().getAttribute('data-content-source'),'screen:TR_SCREEN');await page.evaluate(()=>window.stageFixture.camera(true));
  await page.evaluate(()=>window.stageFixture.replaceTrack());await page.waitForTimeout(160);assert(await page.evaluate(()=>window.primaryVideo===document.querySelector('[data-content-source] video')));record('camera off/on/replacement does not disturb screen');
  await page.evaluate(()=>window.stageFixture.muteShare(true));await page.getByRole('status').filter({hasText:'Трансляция приостановлена'}).waitFor();assert.equal(await primary().getAttribute('data-content-source'),'screen:TR_SCREEN');await page.evaluate(()=>window.stageFixture.muteShare(false));
  await page.evaluate(()=>window.stageFixture.replaceScreen());await page.waitForFunction(()=>document.querySelector('[data-content-source] video')?.readyState>=2);assert(await page.evaluate(()=>{const next=document.querySelector('[data-content-source] video');const changed=next!==window.primaryVideo&&!window.primaryVideo.isConnected;window.primaryVideo=next;return changed}));assert.equal(await primary().getAttribute('data-content-source'),'screen:TR_SCREEN');record('same-publication replacement explicitly replaces only video and restores canvas frames; mute keeps selection');
  const perf=await page.evaluate(()=>{window.perfObserver.disconnect();return {longTasks:window.longTasks,primaryReadyState:window.primaryVideo.readyState,primarySize:[window.primaryVideo.videoWidth,window.primaryVideo.videoHeight],attachedElements:[...window.stageFixture.room.remoteParticipants.values()].flatMap(p=>[...p.videoTrackPublications.values()].map(pub=>({sid:pub.trackSid,elements:pub.track?.attachedElements.length}))),audioCount:document.querySelectorAll('audio').length};});record('synthetic presentation performance observations',perf);
  await open(3);await share();await content().waitFor();await page.getByRole('combobox',{name:'Смотреть',exact:true}).selectOption('screen:TR_SCREEN');await share(1);await page.waitForTimeout(150);assert.equal(await primary().getAttribute('data-content-source'),'screen:TR_SCREEN');
  await page.getByRole('button',{name:'Split',exact:true}).click();await page.getByRole('combobox',{name:'Второй источник'}).selectOption('screen:TR_SCREEN_1');await shot('two-screen-shares');record('new share does not steal primary; two screens selectable');
  await page.evaluate(()=>window.stageFixture.stopShare());await page.waitForTimeout(150);assert.equal(await sourceCount(),1);assert.equal(await primary().getAttribute('data-content-source'),'screen:TR_SCREEN_1');record('stopped primary falls back to Split survivor');
  await share();await page.waitForTimeout(150);assert.equal(await primary().getAttribute('data-content-source'),'screen:TR_SCREEN_1');record('later share does not steal fallback');
  await open(3);await share();await content().waitFor();await page.evaluate(()=>window.stageFixture.stopShare());await page.locator('[data-layout="grid"]').waitFor();await share(1);await content().waitFor();assert.equal(await primary().getAttribute('data-content-source'),'screen:TR_SCREEN_1');record('Auto promotes a new screen after an earlier automatic share ends');
  await page.getByRole('combobox',{name:'Смотреть',exact:true}).selectOption(JSON.stringify(['person-1','camera']));await share();await page.waitForTimeout(180);assert.equal(await primary().getAttribute('data-content-source'),JSON.stringify(['person-1','camera']));record('manual camera choice inside Auto cannot be stolen by a new screen');
  await page.getByRole('button',{name:'Авто',exact:true}).click();await page.waitForTimeout(180);assert((await primary().getAttribute('data-content-source')).startsWith('screen:'));record('explicit Auto resets manual source intent');
  await open();await share();await content().waitFor();await page.getByRole('combobox',{name:'Смотреть',exact:true}).selectOption('screen:TR_SCREEN');await page.evaluate(()=>{window.stageFixture.removeCamera();window.stageFixture.stopShare();});await page.locator('[data-layout="voice"]').waitFor();assert.equal(await page.evaluate(()=>window.stageFixture.view().selectedScreenTrackSid),null);await share();await page.waitForTimeout(180);assert.equal(await page.locator('[data-layout="voice"]').count(),1);record('last manually selected source ends: clear stale SID, Voice fallback, new session does not reopen Content');
  for(const ratio of [9/16,32/9]) {await open();await share(0,ratio);await content().waitFor();await page.waitForFunction(()=>document.querySelector('[data-content-source] video')?.readyState>=2);await checkGeometry();await shot(ratio<1?'portrait-screen':'ultrawide-screen');record(`source aspect ${ratio}`);}
  for(const [w,h] of [[1920,1080],[1440,900],[1366,768],[1024,768],[1024,600],[1000,700]]) {
   await open(4,w,h);await share();await content().waitFor();record(`${w}x${h} 4 participants + screen`,await checkGeometry());
   await page.getByRole('button',{name:'Переписка звонка',exact:true}).click();record(`${w}x${h} chat-open Content`,await checkGeometry());
   await page.getByRole('button',{name:'Split',exact:true}).click();record(`${w}x${h} chat-open Split`,await checkGeometry());
   if(w===1024&&h===600)await shot('narrow-open-chat');
  }
  await open(5);for(let i=0;i<4;i++)await share(i);await content().waitFor();assert.equal(await page.getByRole('combobox',{name:'Смотреть',exact:true}).locator('option').count(),8);await checkGeometry();record('8 mixed sources');
  await page.getByRole('button',{name:'Голос',exact:true}).click();await page.evaluate(()=>window.stageFixture.stopShare(2));await share(2);assert.equal(await page.locator('[data-layout="voice"]').count(),1);
  await page.getByRole('button',{name:'Сетка',exact:true}).click();await page.locator('[data-card-id="person-1"]').click();await page.getByRole('button',{name:'Кино',exact:true}).click();await page.keyboard.press('Escape');await page.getByRole('button',{name:'Сетка',exact:true}).click();record('Voice/Grid/Focus/Cinema remain available');
  await page.getByRole('button',{name:'Контент',exact:true}).click();await content().waitFor();await page.getByRole('combobox',{name:'Смотреть',exact:true}).selectOption(JSON.stringify(['person-1','camera']));
  await page.getByRole('button',{name:'Split',exact:true}).click();await page.getByRole('combobox',{name:'Второй источник'}).selectOption(JSON.stringify(['person-2','camera']));await shot('two-cameras-split');record('two cameras with no duplicate person surfaces');
  await page.emulateMedia({reducedMotion:'reduce'});await shot('reduced-motion');assert.equal(await content().evaluate(e=>e.getAnimations({subtree:true}).filter(a=>a.playState==='running').length),0);record('reduced motion');
  const counts=await page.evaluate(()=>window.stageFixture.counts());assert.deepEqual(counts,{connections:0,publications:0});record('presentation never connects or publishes',counts);assert.deepEqual(errors,[]);
 }catch(error){console.error(error);console.log(await page.locator('[data-content-view]').evaluate(e=>({sources:[...e.querySelectorAll('[data-content-source]')].map(e=>e.dataset.contentSource),selects:[...e.querySelectorAll('select')].map(s=>({label:s.getAttribute('aria-label'),value:s.value,opts:[...s.options].map(o=>({v:o.value,d:o.disabled}))}))})));process.exitCode=1;results.push({status:'FAIL',error:String(error),stack:error.stack});await shot('failure');}
 finally{fs.writeFileSync(`${out}/results.json`,JSON.stringify({media:'SYNTHETIC canvas in production CallUi; no server/audio/getStats acceptance',realMedia:'NOT RUN',results,errors},null,2));await browser.close();}
})();
