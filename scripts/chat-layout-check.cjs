// Real AppLayout/InboxLayout/SettingsContentSlot/DmChat with controlled API responses.
const { chromium } = require(process.env.STAGE10_PLAYWRIGHT || 'C:/Users/Пользователь/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const out = 'artifacts/stages/work/settings-promotion/chat';
const base = process.env.CHAT_LAYOUT_BASE || 'http://127.0.0.1:5199';
const sizes = [[1920,1080],[1740,890],[1440,900],[1366,768],[1024,768],[1000,700]];
const sender = {id:2,username:'peer',displayName:'Peer',status:'ONLINE',avatarUrl:null};
const rooms = [42,43].map(id => ({id,name:id===43?'Group fixture':'Peer',type:id===43?'GROUP':'PRIVATE',avatarUrl:null,isActive:true,createdAt:'2026-10-20T12:00:00Z',lastMessageId:null,lastMessageContent:null,lastActivityAt:null,unreadCount:0,firstUnreadMessageId:null,members:[sender,{...sender,id:1,username:'fixture'}]}));
let scenario = 'empty';
function messages(roomId) {
  const count = scenario === 'empty' ? 0 : scenario === 'short' ? 3 : 120;
  return Array.from({length:count},(_,i)=>({id:i+1,content:scenario==='long-text'?'Long text '.repeat(150):scenario==='pagination'?'History text '.repeat(40):`Message ${i+1}`,type:'TEXT',eventType:'MESSAGE',sentAt:'2026-10-20T12:00:00Z',sender,room:{id:roomId,type:roomId===43?'GROUP':'PRIVATE'},editedAt:null,replyToMessageId:null,replyPreview:null,attachments:i===119&&['video','images','files'].includes(scenario)?Array.from({length:scenario==='images'?3:1},(_,j)=>({id:1000+j,type:scenario==='video'?'VIDEO':scenario==='images'?'IMAGE':'FILE',originalFileName:`attachment-${j}`,contentType:scenario==='video'?'video/webm':scenario==='images'?'image/svg+xml':'application/zip',sizeBytes:1024,width:1920,height:1080,url:'/fixture-media',downloadUrl:'/fixture-media'})):[]}));
}
async function measure(page) {
  return page.evaluate(()=>{
    const chat=document.querySelector('textarea[aria-label="Сообщение"]').parentElement.parentElement.parentElement;
    const list=chat.querySelector('[class*="_messages_"]');
    const composer=document.querySelector('textarea[aria-label="Сообщение"]').parentElement.parentElement;
    const header=chat.firstElementChild;
    const slot=document.getElementById('zvonok-settings-content');
    const read=e=>{const c=getComputedStyle(e);return {rect:e.getBoundingClientRect().toJSON(),clientHeight:e.clientHeight,scrollHeight:e.scrollHeight,offsetHeight:e.offsetHeight,clientWidth:e.clientWidth,scrollWidth:e.scrollWidth,scrollTop:e.scrollTop,css:Object.fromEntries(['display','flex','flexDirection','flexGrow','flexShrink','gridTemplateRows','minHeight','maxHeight','height','overflowX','overflowY','position','alignItems','alignSelf','boxSizing','paddingBottom'].map(k=>[k,c[k]]))};};
    return {chat:read(chat),list:read(list),composer:read(composer),header:read(header),slot:read(slot),ancestors:Array.from((function*(e){while(e){yield e;e=e.parentElement}})(chat.parentElement)).map(read),page:{height:innerHeight,scrollHeight:document.documentElement.scrollHeight,width:innerWidth,scrollWidth:document.documentElement.scrollWidth}};
  });
}
function verify(g) {
  assert(Math.abs(g.chat.rect.right-g.slot.rect.right)<2,'chat must fill slot width');
  assert(Math.abs(g.composer.rect.bottom-g.slot.rect.bottom)<2,'composer must reach slot bottom');
  assert(Math.abs(g.header.rect.top-g.slot.rect.top)<2,'header must reach slot top');
  assert(Math.abs(g.list.rect.top-g.header.rect.bottom)<2,'list must follow header');
  assert(Math.abs(g.list.rect.bottom-g.composer.rect.top)<2,'list must fill space above composer');
  assert(['auto','scroll'].includes(g.list.css.overflowY),'history owns scrolling');
  assert(g.composer.rect.height>0 && g.composer.rect.bottom<=g.page.height+1,'composer visible');
  assert(g.page.scrollHeight<=g.page.height+1,'page cannot grow with history');
  assert(g.page.scrollWidth<=g.page.width+1 && g.list.scrollWidth<=g.list.clientWidth+1,'no horizontal overflow');
}
(async()=>{
  fs.mkdirSync(out,{recursive:true});
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage();const results=[];const errors=[];
  const clip=Buffer.from(await page.evaluate(async()=>{
    const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;
    canvas.getContext('2d').fillRect(0,0,1280,720);
    const stream=canvas.captureStream(10);const recorder=new MediaRecorder(stream,{mimeType:'video/webm'});const chunks=[];
    const blob=await new Promise(resolve=>{recorder.ondataavailable=e=>chunks.push(e.data);recorder.onstop=()=>resolve(new Blob(chunks));recorder.start();setTimeout(()=>recorder.stop(),500)});
    stream.getTracks().forEach(track=>track.stop());return Array.from(new Uint8Array(await blob.arrayBuffer()));
  }));
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://localhost:8080/api/**',async route=>{
    const url=new URL(route.request().url());const match=url.pathname.match(/\/rooms\/(\d+)\/messages$/);
    let data=url.pathname.endsWith('/rooms/all')?rooms:match?messages(Number(match[1])):url.pathname.endsWith('/active-call')?null:[];
    if(match&&scenario==='pagination')data=data.filter(m=>!url.searchParams.has('beforeMessageId')||m.id<Number(url.searchParams.get('beforeMessageId'))).slice(-15);
    if(url.pathname.endsWith('/playback-access'))data={attachmentId:1000,url:base+'/fixture-video.webm',expiresAt:'2099-01-01T00:00:00Z',mimeType:'video/webm',byteSize:clip.length,variant:'original',rangeCapable:false};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });
  await page.route('**/fixture-video.webm',route=>route.fulfill({contentType:'video/webm',body:clip}));
  await page.route('**/fixture-media',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"><rect width="1920" height="1080" fill="teal"/></svg>'}));
  async function open(name,room=42){scenario=name;await page.goto(`${base}/dm?roomId=${room}&real-chat=1`);await page.locator('textarea[aria-label="Сообщение"]').waitFor();await page.waitForFunction(()=>window.settingsFixture.view().message.status==='succeeded');await page.waitForTimeout(200);}
  async function record(name){const g=await measure(page);verify(g);results.push({name,...g});console.log('PASS',name);return g;}
  try {
    await page.setViewportSize({width:1740,height:890});await open('short');
    // Reproduce each missing declaration without changing the real DOM structure.
    const chat=page.locator('textarea[aria-label="Сообщение"]').locator('../../..');
    await chat.evaluate(e=>e.style.flex='0 1 auto');
    const beforeWidth=await measure(page);results.push({name:'BEFORE missing flex growth',...beforeWidth});
    assert(beforeWidth.chat.rect.width<beforeWidth.slot.rect.width-100);
    await page.screenshot({path:`${out}/before-width.png`});
    await chat.evaluate(e=>{e.style.flex='';e.style.display='block'});
    const beforeDisplay=await measure(page);results.push({name:'BEFORE missing display flex',...beforeDisplay});
    assert(beforeDisplay.composer.rect.bottom<beforeDisplay.slot.rect.bottom-100);
    await page.screenshot({path:`${out}/before-display.png`});
    await chat.evaluate(e=>e.style.display='');
    for(const [width,height] of sizes){
      await page.setViewportSize({width,height});
      for(const name of ['empty','short','long','long-text','video','images','files']){
        await open(name);
        if(name==='video'){
          await page.getByRole('button',{name:/Воспроизвести видео/}).click();
          await page.waitForFunction(()=>document.querySelector('video')?.videoWidth>0);
        }
        const g=await record(`${name} ${width}x${height}`);
        if(!['empty','short'].includes(name))assert(g.list.scrollHeight>g.list.clientHeight,'long history scrolls');
        if(!['empty','short'].includes(name))assert(g.list.scrollHeight-g.list.clientHeight-g.list.scrollTop<2,'opening history follows latest message');
        if(width===1740)await page.screenshot({path:`${out}/${name}.png`});
        if(['short','long','video'].includes(name))await page.screenshot({path:`${out}/${name}-${width}x${height}.png`});
      }
      await open('long',43);await record(`GROUP ${width}x${height}`);
    }
    await page.setViewportSize({width:1740,height:890});await open('short');
    await page.locator('textarea[aria-label="Сообщение"]').fill('Draft survives settings');
    
    await page.getByRole('button',{name:'Настройки пользователя',exact:true}).click();
    await page.getByRole('button',{name:'Закрыть настройки',exact:true}).click();
    await record('Settings V2 return');assert.equal(await page.locator('textarea[aria-label="Сообщение"]').inputValue(),'Draft survives settings');
    
    await page.getByRole('button',{name:'Настройки пользователя',exact:true}).click();
    await page.getByRole('button',{name:'Закрыть настройки',exact:true}).click();await record('Default settings return (old flag absent)');
    await page.getByLabel('Модель звонка').selectOption('compact');await record('Compact dock');
    await page.getByLabel('Модель звонка').selectOption('expanded');
    await page.getByLabel('Модель звонка').selectOption('compact');await page.locator('textarea[aria-label="Сообщение"]').waitFor();await record('Expanded to compact');
    await page.getByLabel('Модель звонка').selectOption('idle');
    await open('long');
    const list=page.locator('[class*="_messages_"]');
    await list.evaluate(e=>e.scrollTop=400);await page.waitForTimeout(100);
    const reading=await list.evaluate(e=>e.scrollTop);
    for (const roomId of [42,43]) {
      await open('long',roomId);await list.evaluate(e=>e.scrollTop=400);await page.waitForTimeout(100);
      await page.locator('textarea[aria-label="Сообщение"]').fill('Continuity '+roomId);
      await page.evaluate(()=>{window.promotionList=document.querySelector('[class*="_messages_"]');window.promotionScroll=window.promotionList.scrollTop;});
      await page.getByRole('button',{name:'Настройки пользователя',exact:true}).click();await page.getByRole('searchbox').waitFor();
      assert(await page.evaluate(()=>window.promotionList.isConnected));
      await page.getByRole('button',{name:'Закрыть настройки',exact:true}).click();
      assert.equal(await page.locator('textarea[aria-label="Сообщение"]').inputValue(),'Continuity '+roomId);
      assert(await page.evaluate(()=>document.querySelector('[class*="_messages_"]')===window.promotionList));
      assert.equal(await list.evaluate(e=>e.scrollTop),await page.evaluate(()=>window.promotionScroll));
      assert.equal(await page.evaluate(()=>window.settingsFixture.view().message.activeRoomId),roomId);await record('Settings continuity '+roomId);
    }
    await open('long');await list.evaluate((e, position)=>e.scrollTop=position, reading);await page.waitForTimeout(100);
    await page.evaluate(()=>{const f=window.settingsFixture;const old=f.view().message.messages.at(-1);f.dispatch({type:'message/execEventMessage',payload:{...old,id:121,content:'Incoming while reading'}})});
    await page.waitForTimeout(100);assert.equal(await list.evaluate(e=>e.scrollTop),reading);await record('Incoming message preserves reading position');
    await page.getByRole('complementary',{name:'Личные сообщения и группы'}).getByText('Group fixture',{exact:true}).click();
    await page.waitForFunction(()=>window.settingsFixture.view().message.activeRoomId===43&&window.settingsFixture.view().message.status==='succeeded');await record('DM to GROUP navigation');
    await page.getByRole('complementary',{name:'Личные сообщения и группы'}).getByText('Peer',{exact:true}).click();
    await page.waitForFunction(()=>window.settingsFixture.view().message.activeRoomId===42&&window.settingsFixture.view().message.status==='succeeded');await record('GROUP to DM navigation');
    await open('pagination');
    const anchor=page.locator('[data-id="106"] [class*="_msg-text_"]');
    await list.evaluate(e=>e.scrollTop=1);await page.waitForTimeout(100);
    const anchorBefore=(await anchor.boundingBox()).y;
    await list.evaluate(e=>e.scrollTop=0);
    await page.waitForFunction(()=>window.settingsFixture.view().message.messages.length===30);
    await page.waitForTimeout(150);
    assert(Math.abs((await anchor.boundingBox()).y-anchorBefore)<=2,'older history preserves anchor: '+anchorBefore+' -> '+(await anchor.boundingBox()).y);
    await record('Older history prepend anchoring');
    await page.locator('textarea[aria-label="Сообщение"]').fill('Line\n'.repeat(30));await record('Multiline composer');
    assert(await page.locator('textarea[aria-label="Сообщение"]').evaluate(e=>e.clientHeight<=180&&e.scrollHeight>e.clientHeight));
    assert.deepEqual(errors,[]);
  } finally {await page.screenshot({path:out+'/last.png'});fs.writeFileSync(`${out}/geometry.json`,JSON.stringify({results,errors},null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});






