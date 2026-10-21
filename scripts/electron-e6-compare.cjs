const { chromium, _electron } = require(process.env.STAGE10_PLAYWRIGHT || 'C:/Users/Пользователь/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const out = path.resolve(process.env.ZVONOK_E6_OUTPUT || 'artifacts/stages/electron-e6/compare'); fs.mkdirSync(out, { recursive: true });
const base = 'http://127.0.0.1:3038', api = 'http://127.0.0.1:18086/api', rows = [];
const users = [0, 1].map(i => ({ username: `e6${Date.now()}${i}`, password: crypto.randomBytes(18).toString('hex') }));
let browser, desktop;
const appUrl = (page, route) => page.url().startsWith('file:') ? page.url().split('#')[0] + '#' + route : base + route;
async function instrument(context) {
  await context.addInitScript(() => {
    sessionStorage.setItem('zvonok.callTrace', '1'); window.e6Timeline = []; window.e6PCs = []; window.e6Security = []; window.e6Stomp=[];
    document.addEventListener('securitypolicyviolation', event => {
      let blocked; try { const url=new URL(event.blockedURI); blocked=url.origin+url.pathname; } catch { blocked='non-url'; }
      window.e6Security.push({monotonicMs:Math.round(performance.now()),directive:event.effectiveDirective,blocked});
    });
    const PC = window.RTCPeerConnection;
    window.RTCPeerConnection = new Proxy(PC, { construct(Target, args) { const pc = new Target(...args); window.e6PCs.push(pc);return pc; } });
    const WS=window.WebSocket;
    window.WebSocket=new Proxy(WS,{construct(Target,args){const socket=new Target(...args);if(String(args[0]).includes('/ws-raw'))window.e6Stomp.push(socket);return socket;}});
    const table = console.table;
    console.table = data => { if (Array.isArray(data) && data[0]?.monotonicMs !== undefined) window.e6Timeline.push(...data); table(data); };
  });
}
async function login(context, user, existing) {
  const page = existing || await context.newPage(); page.setDefaultTimeout(25000); await page.goto(appUrl(page, '/auth/login'));
  await page.locator('[name=usernameOrEmail]').fill(user.username); await page.locator('[name=password]').fill(user.password);
  await page.getByRole('button', { name: 'Вход', exact: true }).click();

  await page.evaluate(() => {
    const root = document.getElementById('root'); const fiber = root[Object.keys(root).find(k => k.startsWith('__reactContainer$'))];
    const stack = [fiber.stateNode?.current || fiber];
    while (stack.length) { const f = stack.pop(); if (f.memoizedProps?.store?.getState) { window.e6Store = f.memoizedProps.store; return; } if (f.child) stack.push(f.child); if (f.sibling) stack.push(f.sibling); }
    throw Error('Store missing');
  });
  await page.waitForFunction(() => window.e6Store.getState().websocket.isConnected);
  return page;
}
async function http(page, route, method = 'GET', body) {
  const token = await page.evaluate(() => window.e6Store.getState().user.accessToken);
  const response = await fetch(api + route, { method, headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  assert(response.ok, `${route}: ${response.status}`); return response.json();
}
const state = page => page.evaluate(async () => {
  const s = window.e6Store.getState();
  return { callId: s.call.callId, status: s.call.status, owner: s.call.mediaOwnership, generation: s.call.mediaGeneration, media: s.call.mediaState, stomp: s.websocket.status };
});
async function dispatch(page, type, payload) { return page.evaluate(async ({ type, payload }) => { window.e6Store.dispatch({ type, payload }); }, { type, payload }); }
async function waitConnected(page) { await page.waitForFunction(() => window.e6Store.getState().call.mediaState === 'connected' && window.e6Store.getState().call.presentationInitialized && window.e6PCs.some(pc => pc.connectionState === 'connected'), null, { timeout: 40000 }); }
async function stats(page) { return page.evaluate(async () => {
  const rows = [];
  for (const pc of window.e6PCs) if (pc.connectionState === 'connected') (await pc.getStats()).forEach(s => { if (s.type === 'inbound-rtp' && s.kind === 'audio') rows.push({ packets: s.packetsReceived, bytes: s.bytesReceived }); });
  return rows;
}); }
async function settings(page, category) {
  await page.getByRole('button',{name:'Настройки пользователя',exact:true}).click();
  await page.getByRole('navigation',{name:'Разделы настроек',exact:true}).getByRole('button',{name:category,exact:true}).click();
}
async function runCall(name, a, b, roomId) {
  for (const page of [a,b]) {
    await page.goto(appUrl(page, `/dm?roomId=${roomId}`));
    await page.waitForFunction(() => document.querySelector('[aria-label="Панель пользователя"]'));
    await page.evaluate(() => { const root = document.getElementById('root'), fiber = root[Object.keys(root).find(k => k.startsWith('__reactContainer$'))], stack = [fiber.stateNode?.current || fiber]; while (stack.length) { const f = stack.pop(); if(f.memoizedProps?.store?.getState) { window.e6Store=f.memoizedProps.store; return; } if(f.child)stack.push(f.child);if(f.sibling)stack.push(f.sibling); } });
    await page.waitForFunction(() => window.e6Store.getState().websocket.isConnected);
  }
  const reload=name==='native-reload-connecting';
  if(reload)await desktop.evaluate(({session})=>session.defaultSession.webRequest.onBeforeRequest({urls:['ws://127.0.0.1:48886/*']},(_details,callback)=>setTimeout(()=>callback({}),2000)));
  await a.getByRole('button', { name:'Начать звонок', exact:true }).click();
  await b.waitForFunction(async () => window.e6Store.getState().call.status === 'incoming_ringing');
  if(name.startsWith('native-incoming')) {
    const windowId=await desktop.evaluate(({BrowserWindow},url)=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL()===url).id,b.url());
    assert.equal(await desktop.evaluate(({BrowserWindow},id)=>BrowserWindow.fromId(id).isVisible(),windowId),false);
    await b.waitForTimeout(1200);
    rows.push({name:name+' hidden notification diagnostics',renderer:await b.evaluate(()=>({focused:document.hasFocus(),visibility:document.visibilityState,dnd:window.e6Store.getState().device.notificationPolicy.dnd,enabled:window.e6Store.getState().device.desktopNotificationsEnabled})),native:await desktop.evaluate(({Notification})=>({supported:Notification.isSupported(),...globalThis.e6Notifications}))});
    await desktop.evaluate(({BrowserWindow},id)=>{BrowserWindow.fromId(id).show();BrowserWindow.fromId(id).focus();},windowId);
  }
  const incoming = await state(b); await b.getByRole('button', {name:'Принять',exact:true}).click();
  if(reload){
    await a.waitForFunction(()=>window.e6Store.getState().call.participantToken && !window.e6PCs.some(pc=>pc.connectionState==='connected'));
    const navigation=a.waitForEvent('framenavigated',{predicate:frame=>frame===a.mainFrame()});
    await desktop.evaluate(({BrowserWindow},url)=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL()===url).reload(),a.url());await navigation;
    await desktop.evaluate(({session})=>session.defaultSession.webRequest.onBeforeRequest(null));
    await a.locator('[aria-label="Панель пользователя"]').waitFor();await a.evaluate(()=>{const root=document.getElementById('root'),fiber=root[Object.keys(root).find(k=>k.startsWith('__reactContainer$'))],stack=[fiber.stateNode?.current||fiber];while(stack.length){const f=stack.pop();if(f.memoizedProps?.store?.getState){window.e6Store=f.memoizedProps.store;return;}if(f.child)stack.push(f.child);if(f.sibling)stack.push(f.sibling);}});
  }
  try {
    await waitConnected(a); await waitConnected(b);
    for (const page of [a,b]) {
      if ((await page.evaluate(() => window.e6Store.getState().call.presentationMode)) !== 'expanded') await page.locator('[data-call-dock]').getByRole('button', {name:'Развернуть',exact:true}).click();
      await page.locator('[data-call-stage]:not([hidden])').getByRole('button', {name: /^Микрофон: выключен/}).first().click();
      await page.locator('[data-call-stage]:not([hidden])').getByRole('button', {name: /^Микрофон: включён/}).first().waitFor();
    }
    const before = await stats(a),reverseBefore=await stats(b); await a.waitForTimeout(3500); const after = await stats(a),reverseAfter=await stats(b);
    assert(after.some((s, i) => s.bytes > (before[i]?.bytes ?? 0)), 'Real inbound audio bytes must increase');
    assert(reverseAfter.some((s,i)=>s.bytes>(reverseBefore[i]?.bytes??0)),'Reverse inbound audio bytes must increase');
    rows.push({ name, status: 'PASS', a: await state(a), b: await state(b), before, after,reverseBefore,reverseAfter });
    if(name === 'electron-dev') {
      const geometry=()=>a.locator('[aria-label="Управление звонком"]').evaluate(el=>{const r=el.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height,viewport:innerHeight};});
      const connected=await geometry();
      await a.evaluate(()=>{const c=window.e6Store.getState().call;window.e6Store.dispatch({type:'call/mediaConnectionChanged',payload:{roomName:c.livekitRoomName,generation:c.mediaGeneration,status:'reconnecting'}});});
      await a.waitForTimeout(100); const recovering=await geometry();
      await a.screenshot({path:path.join(out,'electron-recovering-layout.png')});
      await a.evaluate(()=>{const c=window.e6Store.getState().call;window.e6Store.dispatch({type:'call/mediaConnectionChanged',payload:{roomName:c.livekitRoomName,generation:c.mediaGeneration,status:'connected'}});});
      rows.push({name:'recovery banner geometry (presentation-only injection; transport remains real)',connected,recovering});
    }
    if(name === 'electron-packaged') {
      const generation=(await state(a)).generation;
      const settingsPCs=await a.evaluate(()=>window.e6PCs.length);await settings(a,'Уведомления');
      const settingsBefore=await stats(b);await a.waitForTimeout(1200);const settingsAfter=await stats(b);
      assert(settingsAfter.some((s,i)=>s.bytes>(settingsBefore[i]?.bytes??0)));assert.equal((await state(a)).generation,generation);assert.equal(await a.evaluate(()=>window.e6PCs.length),settingsPCs);
      await a.screenshot({path:path.join(out,'native-settings-during-call.png')});await a.getByRole('button',{name:'Закрыть настройки',exact:true}).click();
      rows.push({name:'Actual Settings open/close preserves media generation, PC count and growing RTP',status:'PASS'});
      await a.evaluate(()=>window.e6Stomp.findLast(socket=>socket.readyState===1)?.close());
      await a.waitForTimeout(100); assert.equal((await state(a)).media,'connected');
      await a.waitForFunction(()=>window.e6Store.getState().websocket.isConnected); assert.equal((await state(a)).generation,generation);
      rows.push({name:'STOMP socket lost, LiveKit alive; resubscribe preserves generation',status:'PASS'});
      await a.evaluate(()=>{const u=window.e6Store.getState().user;window.e6Store.dispatch({type:'user/addJwt',payload:{accessToken:u.accessToken,tokenType:u.tokenType,expiresIn:1000}});window.dispatchEvent(new Event('focus'));});
      await a.waitForTimeout(800); await a.evaluate(()=>window.dispatchEvent(new Event('focus')));
      await a.waitForFunction(()=>window.e6Store.getState().user.expiresIn>1000 && window.e6Store.getState().websocket.isConnected);
      assert.equal((await state(a)).generation,generation); rows.push({name:'Real refresh cookie rotation after controlled client expiry and STOMP recovery',status:'PASS'});
      const mainId=await desktop.evaluate(({BrowserWindow},url)=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL()===url).id,a.url());
      const pcCount=await a.evaluate(()=>window.e6PCs.length);
      await a.evaluate(()=>window.zvonokDesktop.dock.open());
      const dock=await desktop.waitForEvent('window',{timeout:5000}).catch(()=>desktop.windows().find(p=>p.url().includes('dock.html')));
      assert(dock); await dock.locator('#microphone').waitFor();
      await dock.locator('#top').check();assert.equal(await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.getTitle()==='Zvonok — звонок').isAlwaysOnTop()),true);
      await dock.locator('#top').uncheck();
      await desktop.evaluate(({BrowserWindow},id)=>BrowserWindow.fromId(id).close(),mainId);
      assert.equal(await desktop.evaluate(({BrowserWindow},id)=>BrowserWindow.fromId(id).isVisible(),mainId),false);
      await a.waitForTimeout(1800); assert.equal((await state(a)).media,'connected');
      await dock.locator('#main').click(); await dock.locator('#close').click();
      assert.equal(await a.evaluate(()=>window.e6PCs.length),pcCount);
      rows.push({name:'Real call survives main hide/restore and controller-only dock open/close',status:'PASS'});
      const takeoverContext=await browser.newContext({permissions:['microphone','camera']});await instrument(takeoverContext);
      const takeover=await login(takeoverContext,users[0]);
      await takeover.waitForFunction(()=>window.e6Store.getState().call.mediaOwnership==='PASSIVE');
      assert.equal((await state(a)).owner,'OWNED');
      await takeover.getByRole('button',{name:'Перенести звонок сюда',exact:true}).click();
      await waitConnected(takeover);
      await a.waitForFunction(()=>window.e6Store.getState().call.mediaOwnership==='PASSIVE');
      assert.equal(await a.evaluate(()=>window.e6PCs.filter(pc=>pc.connectionState==='connected').length),0);
      await a.getByRole('button',{name:'Перенести звонок сюда',exact:true}).click();await waitConnected(a);
      await takeover.waitForFunction(()=>window.e6Store.getState().call.mediaOwnership==='PASSIVE');
      assert.equal(await takeover.evaluate(()=>window.e6PCs.filter(pc=>pc.connectionState==='connected').length),0);
      await takeoverContext.close();rows.push({name:'Real browser/Electron handoff in both directions; previous media connections stop',status:'PASS'});
      rows.push({name:'Display geometry',displays:await desktop.evaluate(({screen})=>screen.getAllDisplays().map(d=>({bounds:d.bounds,scaleFactor:d.scaleFactor}))) });
      await desktop.evaluate(({BrowserWindow},id)=>BrowserWindow.fromId(id).maximize(),mainId);await a.waitForTimeout(200);assert.equal((await state(a)).media,'connected');
      await desktop.evaluate(({BrowserWindow},id)=>BrowserWindow.fromId(id).unmaximize(),mainId);rows.push({name:'Maximize/restore and dock always-on-top retain actual media connection',status:'PASS'});
      const scaled=await desktop.evaluate(({BrowserWindow,screen},id)=>{
        const window=BrowserWindow.fromId(id),display=screen.getAllDisplays().find(d=>d.scaleFactor===1.25);if(!display)return null;
        const original=window.getBounds();window.setBounds({x:display.workArea.x+12,y:display.workArea.y+12,width:1100,height:740});return original;
      },mainId);
      if(scaled){await a.waitForTimeout(500);const ratio=await a.evaluate(()=>devicePixelRatio);assert.equal(ratio,1.25);await a.screenshot({path:path.join(out,'native-dpi-125.png')});await desktop.evaluate(({BrowserWindow},{id,bounds})=>BrowserWindow.fromId(id).setBounds(bounds),{id:mainId,bounds:scaled});rows.push({name:'Actual window on the real 125 percent monitor',status:'PASS',devicePixelRatio:ratio});}
      if(process.argv.includes('--contracts')) {
        const contexts=await Promise.all([browser.newContext(),browser.newContext()]);for(const c of contexts)await instrument(c);
        const candidates=await Promise.all(contexts.map(c=>login(c,users[0])));
        for(const p of candidates)await p.waitForFunction(()=>window.e6Store.getState().call.mediaOwnership==='PASSIVE');
        await Promise.all(candidates.map(p=>p.getByRole('button',{name:'Перенести звонок сюда',exact:true}).click()));
        await Promise.race(candidates.map(p=>waitConnected(p)));
        const deadline=Date.now()+25000;
        while(Date.now()<deadline && (await Promise.all(candidates.map(p=>state(p)))).some(s=>s.owner==='TRANSFERRING'))await a.waitForTimeout(300);
        const owners=await Promise.all([a,...candidates].map(p=>p.evaluate(()=>window.e6PCs.some(pc=>pc.connectionState==='connected'))));
        assert.equal(owners.filter(Boolean).length,1);
        rows.push({name:'Two concurrent real ownership requests settle to one connected client',status:'PASS',connectedOwners:owners.filter(Boolean).length});
        await a.getByRole('button',{name:'Перенести звонок сюда',exact:true}).click();await waitConnected(a);
        await a.waitForTimeout(5500);for(const c of contexts)await c.close();
        const label=execFileSync('docker',['inspect','zvonok-e6-livekit','--format','{{index .Config.Labels "zvonok.acceptance"}}'],{encoding:'utf8',windowsHide:true}).trim();assert.equal(label,'electron-e6');
        let paused;
        try {execFileSync('docker',['pause','zvonok-e6-livekit'],{windowsHide:true});paused=true;await a.waitForTimeout(1000);const stopped=await stats(a);await a.waitForTimeout(4000);const held=await stats(a);assert(held.every((s,i)=>s.packets<=(stopped[i]?.packets??0)+5));}
        finally{if(paused)execFileSync('docker',['unpause','zvonok-e6-livekit'],{windowsHide:true});}
        const beforeResume=await stats(a);await a.waitForTimeout(2500);const resumed=await stats(a);assert(resumed.some((s,i)=>s.bytes>(beforeResume[i]?.bytes??0)));assert.equal((await state(a)).owner,'OWNED');
        rows.push({name:'Actual isolated SFU transport pause/resume restores increasing RTP without false ownership loss',status:'PASS'});
      }
    }
    if (name.startsWith('electron')) {
      for (const [width, height] of [[1920,1080],[1600,900],[1366,768],[1024,768]]) {
        const id = await desktop.evaluate(({ BrowserWindow }, url) => BrowserWindow.getAllWindows().find(w => w.webContents.getURL() === url).id, a.url());
        await desktop.evaluate(({ BrowserWindow }, { id, width, height }) => BrowserWindow.fromId(id).setContentSize(width,height), { id, width, height });
        await a.waitForTimeout(300); await a.screenshot({ path: path.join(out, `${name}-${width}.png`) });
        rows.push({ name: `geometry-${width}`, geometry: await a.evaluate(() => ({ clientHeight: document.documentElement.clientHeight, scrollHeight: document.documentElement.scrollHeight, width: innerWidth, height: innerHeight })) });
      }
    }
  } catch (e) { rows.push({ name, status: 'FAIL', reason: e.message, a: await state(a), b: await state(b), buttons: await a.getByRole('button').allTextContents() }); await a.screenshot({ path: path.join(out, `${name}-failure.png`) }); }
  finally {
    for (const [label, page] of [['a',a],['b',b]]) fs.writeFileSync(path.join(out, `${name}-${label}-timeline.json`), JSON.stringify(await page.evaluate(() => window.e6Timeline), null, 2));
    fs.writeFileSync(path.join(out, `${name}-security.json`), JSON.stringify(await a.evaluate(() => window.e6Security), null, 2));
    await dispatch(a, 'call/sendEnd', { callId: incoming.callId, chatRoomId: roomId }); await dispatch(a, 'call/endCallLocally');
    await a.waitForTimeout(1200);
  }
}
(async () => {
  try {
    for (const user of users) { const r = await fetch(api + '/auth/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...user, email: `${user.username}@example.com` }) }); assert(r.ok, `Isolated register ${r.status}`); }
    browser = await chromium.launch({ headless: true, args: ['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required'] });
    const ca = await browser.newContext({ permissions: ['microphone','camera'] }), cb = await browser.newContext({ permissions: ['microphone','camera'] });
    await instrument(ca); await instrument(cb); let a = await login(ca, users[0]); const b = await login(cb, users[1]);
    await dispatch(a, 'friend/sendFriendRequest', { username: users[1].username });
    await b.waitForTimeout(500);
    const requestId = (await http(b, '/friends/requests/incoming'))[0].requestId;
    await dispatch(b, 'friend/acceptFriendRequest', { requestId });
    await a.waitForTimeout(500);
    const roomId = (await http(a, '/rooms/all')).find(room => room.type === 'PRIVATE').id;
    assert(Number.isInteger(roomId));
    await runCall('web-control', a, b, roomId); await ca.close();
    const env = { ...process.env, VITE_DEV_SERVER_URL: base, ZVONOK_DESKTOP_PROFILE: path.join(out, 'profile') }; delete env.ELECTRON_RUN_AS_NODE;
    desktop = await _electron.launch({ executablePath: path.resolve('node_modules/electron/dist/electron.exe'), args: ['.', '--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required'], env, timeout: 20000 });
    await instrument(desktop.context());
    a = await login(desktop.context(), users[0], await desktop.firstWindow());
    await runCall('electron-dev', a, b, roomId);
    await desktop.close(); desktop = null;
    const packaged = path.resolve('artifacts/stages/electron-e6/package/win-unpacked/Zvonok.exe');
    desktop = await _electron.launch({ executablePath: packaged, args: ['--user-data-dir=' + path.join(out, 'profile-packaged'), '--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required'], env, timeout:20000 });
    await instrument(desktop.context());
    const packagedPage = await desktop.firstWindow(); packagedPage.setDefaultTimeout(25000); await packagedPage.reload();
    a = await login(desktop.context(), users[0], packagedPage);
    await runCall('electron-packaged', a, b, roomId);
    if(process.argv.includes('--contracts'))await runCall('native-reload-connecting',a,b,roomId);
    await desktop.evaluate(({Notification})=>{
      globalThis.e6Notifications={attempted:0,shown:0,failed:0};const show=Notification.prototype.show;
      Notification.prototype.show=function(){globalThis.e6Notifications.attempted++;globalThis.e6Notifications.lastBody=this.body;this.once('show',()=>globalThis.e6Notifications.shown++);this.once('failed',()=>globalThis.e6Notifications.failed++);return show.call(this);};
    });
    await settings(a,'Уведомления');
    await a.getByRole('checkbox',{name:'Не беспокоить',exact:true}).check();
    await a.getByLabel('Показывать содержимое сообщения',{exact:true}).uncheck();
    await a.locator('#setting-exceptions').getByRole('checkbox').first().check();
    await a.getByLabel('Звук сообщений',{exact:true}).uncheck();
    await a.screenshot({path:path.join(out,'native-notification-settings.png')});
    assert.equal(await a.evaluate(()=>window.e6Store.getState().device.notificationPolicy.dnd),true);
    assert.equal(await a.evaluate(()=>window.e6Store.getState().device.notificationPolicy.exceptions.length),1);
    await a.getByRole('button',{name:'Закрыть настройки',exact:true}).click();
    await desktop.evaluate(({BrowserWindow},url)=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL()===url).hide(),a.url());
    await runCall('native-incoming-dnd', b, a, roomId);
    assert.equal((await desktop.evaluate(()=>globalThis.e6Notifications)).attempted,0);
    rows.push({name:'DND suppresses real incoming native notification; call still accepts and carries RTP',status:'PASS'});
    await desktop.evaluate(({BrowserWindow},url)=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL()===url).show(),a.url());
    await settings(a,'Уведомления'); await a.getByRole('checkbox',{name:'Не беспокоить',exact:true}).uncheck(); await a.getByLabel('Звук сообщений',{exact:true}).check();
    await a.getByRole('button',{name:'Закрыть настройки',exact:true}).click();
    await desktop.evaluate(({BrowserWindow},url)=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL()===url).hide(),a.url());
    await runCall('native-incoming-enabled', b, a, roomId);
    const notifications=await desktop.evaluate(()=>globalThis.e6Notifications);
    const notificationSupported=await desktop.evaluate(({Notification})=>Notification.isSupported());
    rows.push({name:'Actual Windows incoming toast API',status:notifications.shown>0?'PASS':notificationSupported?'FAIL':'NOT RUN',...notifications,scope:'OS show event; physical visibility/click not verified'});
    await settings(a,'Уведомления');await a.getByRole('checkbox',{name:'Не беспокоить',exact:true}).check();await a.getByRole('button',{name:'Закрыть настройки',exact:true}).click();
    await desktop.evaluate(({BrowserWindow},url)=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL()===url).hide(),a.url());
    await dispatch(b,'message/sendMessage',{roomId,content:{content:'E6 isolated message privacy check',replyToMessageId:null}});
    await a.getByText('E6 isolated message privacy check',{exact:true}).last().waitFor({state:'attached'});
    await a.waitForTimeout(700);const messageToast=await desktop.evaluate(()=>globalThis.e6Notifications);
    if(notificationSupported){assert.equal(messageToast.attempted,notifications.attempted+1);assert.equal(messageToast.lastBody,'Новое сообщение');}
    rows.push({name:'Real DM exception reaches native API with redacted payload',status:notificationSupported?'PASS':'NOT RUN',reason:notificationSupported?undefined:'OS notification API unavailable; real message delivery confirmed'});
    await desktop.evaluate(({BrowserWindow},url)=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL()===url).show(),a.url());
    await settings(a,'Уведомления');await a.locator('#setting-exceptions').getByRole('checkbox').first().uncheck();await a.getByRole('button',{name:'Закрыть настройки',exact:true}).click();
    await desktop.evaluate(({BrowserWindow},url)=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL()===url).hide(),a.url());
    await dispatch(b,'message/sendMessage',{roomId,content:{content:'E6 isolated quiet message',replyToMessageId:null}});
    await a.getByText('E6 isolated quiet message',{exact:true}).last().waitFor({state:'attached'});
    await a.waitForTimeout(700);assert.equal((await desktop.evaluate(()=>globalThis.e6Notifications)).attempted,messageToast.attempted);
    rows.push({name:'DND without exception suppresses native message presentation and retains delivery',status:'PASS'});
    await desktop.evaluate(({BrowserWindow},url)=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL()===url).show(),a.url());
    await settings(a,'Приложение');
    const closeSetting=a.getByLabel('При закрытии скрывать окно в системный трей',{exact:true});
    await closeSetting.uncheck(); await a.waitForFunction(async()=>!(await window.zvonokDesktop.preferences.get()).closeToTray);
    await closeSetting.check(); await a.waitForFunction(async()=>(await window.zvonokDesktop.preferences.get()).closeToTray);
    await a.screenshot({path:path.join(out,'native-application-settings.png')});
    await a.getByRole('button',{name:'Закрыть настройки',exact:true}).click();
    rows.push({name:'Native window preference persists after actual IPC readback; updater capabilities rendered',status:'PASS'});
    const alternate=await browser.newContext();await instrument(alternate);const alternatePage=await login(alternate,users[0]);
    const refreshAlternate=()=>alternatePage.evaluate(async endpoint=>{const response=await fetch(endpoint+'/auth/refresh',{method:'POST',credentials:'include'});return {status:response.status,missingCookie:response.ok?false:(await response.json()).message==='Refresh token not transferred'};},api);
    const refreshBefore=await refreshAlternate();assert.equal(refreshBefore.status,200);
    await settings(a,'Аккаунт');
    a.on('dialog',dialog=>dialog.accept());
    const oldToken=await a.evaluate(()=>window.e6Store.getState().user.accessToken);
    await a.getByRole('button',{name:'Выйти везде',exact:true}).click();
    await a.getByText('Сервер подтвердил выход на всех устройствах.',{exact:true}).waitFor();
    const refresh=await refreshAlternate();assert([400,401].includes(refresh.status));assert.equal(refresh.missingCookie,false);
    assert.equal(await a.evaluate(()=>window.e6Store.getState().user.accessToken),null);
    const oldAccess=await fetch(api+'/users/my',{headers:{Authorization:`Bearer ${oldToken}`}});
    rows.push({name:'Real logout-all revokes alternate refresh credential and clears renderer/STOMP',status:'PASS',oldAccessHttpStatus:oldAccess.status,limitation:'Existing stateless access JWT validity policy is unchanged'});
    assert.equal(await a.evaluate(()=>window.e6Store.getState().device.notificationPolicy.dnd),true);
    assert.equal(await a.evaluate(()=>window.e6Store.getState().device.notificationPolicy.preview),false);
    rows.push({name:'Logout preserves local DND/privacy settings while removing account state',status:'PASS'});
    await alternate.close();
  } catch(e) { rows.push({ name: 'campaign', status: 'FAIL', reason: e.message }); if(desktop) { const p=desktop.windows()[0]; if(p) { await p.screenshot({path:path.join(out,'campaign-failure.png')}).catch(()=>{}); rows.push({name:'failed-window',url:p.url(),text:await p.locator('body').innerText().catch(()=> 'unavailable')}); } } process.exitCode = 1; }
  finally { if(rows.some(row=>row.status==='FAIL'))process.exitCode=1;fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ rows, media: 'REAL loopback LiveKit transport; synthetic microphone source; no physical hardware acceptance' }, null, 2)); console.log(JSON.stringify(rows)); await desktop?.close(); await browser?.close(); }
})();

