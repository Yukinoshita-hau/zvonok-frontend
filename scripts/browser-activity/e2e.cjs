const { chromium, _electron } = require(process.env.STAGE10_PLAYWRIGHT || 'C:/Users/Пользователь/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { evaluateMediaAcceptance, MEDIA_PROFILES } = require('./media-acceptance.cjs');
const { analyzeEvents } = require('./av-diagnostics.cjs');
const avCodecPath = require('node:path').join(__dirname, 'av-event-codec.cjs');
const base = process.env.BROWSER_TEST_BASE || 'http://127.0.0.1:3018', api = process.env.BROWSER_TEST_API || 'http://127.0.0.1:18080/api';
let mediaProfile = process.env.BROWSER_MEDIA_PROFILE || `720p${process.env.MEDIA_FPS || 15}`;
if (!MEDIA_PROFILES[mediaProfile]) throw Error(`Unsupported BROWSER_MEDIA_PROFILE: ${mediaProfile}`);
mediaProfile = { name: mediaProfile, ...MEDIA_PROFILES[mediaProfile] };
const out = process.env.BROWSER_TEST_OUT || `artifacts/stages/work/browser-activity-20261021/${process.argv.includes('--audio')?'slice5-audio':'e2e'}-${Date.now()}`; fs.mkdirSync(out, { recursive: true });
const rows = [], errors = [], users = [], networkFailures=[]; let browser, desktop, callId, activityId;
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, ms = 30000) { const end = Date.now() + ms; let last; while (Date.now() < end) { try { const value = await fn(); if (value) return value; } catch (e) { last = e; } await sleep(200); } throw last || Error('Condition timeout'); }
function record(name, details = {}) { rows.push({ name, status: 'PASS', ...details }); console.table(rows.slice(-1)); }
async function http(u, path, method = 'GET', body, expected) {
  const r = await fetch(api + path, { method, headers: { ...(u ? { Authorization: `Bearer ${u.token}` } : {}), ...(body === undefined ? {} : { 'content-type': 'application/json' }) }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(25000) });
  if (expected) { assert.equal(r.status, expected); return; }
  assert(r.ok, `${method} ${path}: ${r.status}`); const text = await r.text(); return text ? JSON.parse(text) : null;
}
async function send(u, destination, body) {
  await u.page.evaluate(({ destination, body }) => { const ws = window.activitySockets.findLast(s => s.readyState === 1); if (!ws) throw Error('No app socket'); const data = body === undefined ? '' : JSON.stringify(body); ws.send(`SEND\ndestination:${destination}\ncontent-type:application/json\ncontent-length:${new TextEncoder().encode(data).length}\n\n${data}\0`); }, { destination, body });
}
async function state(u) {
  const activity = await http(u, `/calls/${callId}/browser-activity`), media = activity?.session?.media;
  if (media?.profile) {
    const target = MEDIA_PROFILES[media.profile];
    assert(target && media.width === target.width && media.height === target.height && media.fps === target.fps, 'Browser Worker media profile contract mismatch');
    mediaProfile = { name: media.profile, ...target };
  }
  return activity;
}
async function clickAt(page, x, y) {
  const rect = await page.locator('[data-activity-source] video').boundingBox(), scale = Math.min(rect.width / mediaProfile.width, rect.height / mediaProfile.height);
  await page.mouse.click(rect.x + (rect.width - mediaProfile.width * scale) / 2 + x * scale, rect.y + (rect.height - mediaProfile.height * scale) / 2 + y * scale);
}
async function command(u, op, body = {}, lease) { const a = lease || await state(u); const c = a?.session?.collaboration; return http(u, `/calls/${callId}/browser-activity/${activityId}/commands`, 'POST', { op, body, epoch: c?.epoch, generation: c ? String(c.generation) : undefined }); }
async function voiceStats(u) { return u.page.evaluate(async () => {
  const result = [];
  for (const pc of window.voicePCsBefore || window.activityPCs) if (pc.connectionState === 'connected') { const stats = await pc.getStats(); stats.forEach(s => { if (s.type === 'inbound-rtp' && s.kind === 'audio') result.push({ packets: s.packetsReceived, bytes: s.bytesReceived }); }); }
  return result;
}); }
async function login(name) {
  const password = crypto.randomBytes(18).toString('hex');
  await http(null, '/auth/register', 'POST', { username: name, email: `${name}@example.com`, password });
  const firstDesktop = process.argv.includes('--electron') && users.length === 0;
  let desktopPage;
  if (firstDesktop) {
    const env = { ...process.env, VITE_DEV_SERVER_URL: base, ZVONOK_DESKTOP_WEB_ORIGIN: base, ZVONOK_DESKTOP_PROFILE: require('node:path').resolve(out, 'electron-profile') };
    delete env.ELECTRON_RUN_AS_NODE;
    desktop = await _electron.launch({ executablePath: require('electron'), args: ['.', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'], env, timeout: 30000 });
    const deadline = Date.now() + 30000;
    while (!desktopPage && Date.now() < deadline) { desktopPage = desktop.windows().find(p => p.url().startsWith(base)); if (!desktopPage) await sleep(100); }
    assert(desktopPage, 'Native Electron local renderer missing');
    const native = await desktop.evaluate(({ BrowserWindow }) => ({ version: process.versions.electron, windows: BrowserWindow.getAllWindows().map(w => ({ sandbox: w.webContents.getLastWebPreferences().sandbox, contextIsolation: w.webContents.getLastWebPreferences().contextIsolation })) }));
    assert(native.windows.every(w => w.sandbox && w.contextIsolation));
    record('Native Windows Electron with sandbox and context isolation', native);
  }
  const context = firstDesktop ? desktop.context() : await browser.newContext({ viewport: { width: 1440, height: 960 } });
  await context.addInitScript(() => {
    window.activityPCs = []; window.activitySockets = []; window.activityBrowserSockets = []; window.activityFrames = [];
    const PC = window.RTCPeerConnection; window.RTCPeerConnection = new Proxy(PC, { construct(Target, args) { const pc = new Target(...args); window.activityPCs.push(pc); return pc; } });
    const WS = window.WebSocket; window.WebSocket = new Proxy(WS, { construct(Target, args) { const ws = new Target(...args); if (String(args[0]).includes(':48033')) window.activityBrowserSockets.push(ws); if (String(args[0]).includes('/ws-raw')) { window.activitySockets.push(ws); ws.addEventListener('message', e => window.activityFrames.push(String(e.data))); } return ws; } });
  });
  const page = desktopPage ?? await context.newPage(), pageErrors=[], failedRequests=[];
  page.on('pageerror', e => { errors.push(e.message); pageErrors.push({at:Date.now(),message:e.message}); });
  page.on('console', e => { if(e.type()==='error')pageErrors.push({at:Date.now(),source:'console',message:e.text()}); });
  page.on('response',r=>{if(r.status()>=400){const url=new URL(r.url()),failure={at:Date.now(),user:name,path:url.pathname,status:r.status()};networkFailures.push(failure);failedRequests.push(failure);}});
  page.on('requestfailed',r=>{const url=new URL(r.url()),failure={at:Date.now(),user:name,path:url.pathname,error:r.failure()?.errorText};networkFailures.push(failure);failedRequests.push(failure);});
  await page.goto(base + '/auth/login', { waitUntil: 'domcontentloaded' }); await page.locator('[name=usernameOrEmail]').fill(name); await page.locator('[name=password]').fill(password); await page.getByRole('button', { name: 'Вход', exact: true }).click();
  await page.waitForFunction(() => window.activityFrames.some(s => s.startsWith('CONNECTED')));
  const token = await page.evaluate(() => {
    const root = document.getElementById('root'), fiber = root[Object.keys(root).find(k => k.startsWith('__reactContainer$'))];
    const stack = [fiber.stateNode?.current || fiber];
    while (stack.length) { const f = stack.pop(); if (f.memoizedProps?.store?.getState) { window.activityStore = f.memoizedProps.store; return window.activityStore.getState().user.accessToken; } if (f.child) stack.push(f.child); if (f.sibling) stack.push(f.sibling); }
    throw Error('No store');
  });
  const u = { name, context, page, token, pageErrors, failedRequests, client: firstDesktop ? 'Electron' : 'Web' }; users.push(u); return u;
}
async function freshDiagnostics(u) {
  return u.page.evaluate(async () => {
    const stats=[];
    for(const [index,pc] of (window.activityPCs||[]).entries()) {
      let report=[];try{report=[...(await pc.getStats()).values()].filter(s=>s.kind==='video'||s.mediaType==='video'||s.type==='candidate-pair').map(s=>({id:s.id,type:s.type,kind:s.kind,mediaType:s.mediaType,state:s.state,selected:s.selected,nominated:s.nominated,bytesReceived:s.bytesReceived,packetsReceived:s.packetsReceived,framesReceived:s.framesReceived,framesDecoded:s.framesDecoded,framesDropped:s.framesDropped,framesPerSecond:s.framesPerSecond,frameWidth:s.frameWidth,frameHeight:s.frameHeight,codecId:s.codecId,localCandidateId:s.localCandidateId,remoteCandidateId:s.remoteCandidateId,currentRoundTripTime:s.currentRoundTripTime}));}catch(e){report=[{error:String(e)}];}
      stats.push({index,connectionState:pc.connectionState,iceConnectionState:pc.iceConnectionState,signalingState:pc.signalingState,iceGatheringState:pc.iceGatheringState,video:report});
    }
    const state=window.activityStore?.getState?.(),{participantToken,...call}=state?.call??{};
    return {at:new Date().toISOString(),url:location.href,metrics:window.browserActivityMetrics??null,store:{call},video:[...document.querySelectorAll('[data-activity-source] video')].map(v=>({readyState:v.readyState,networkState:v.networkState,paused:v.paused,currentTime:v.currentTime,videoWidth:v.videoWidth,videoHeight:v.videoHeight,srcObject:!!v.srcObject,tracks:v.srcObject?.getTracks().map(t=>({kind:t.kind,readyState:t.readyState,muted:t.muted}))??[]})),sockets:[...(window.activityBrowserSockets||[]),...(window.activitySockets||[])].map(s=>({url:s.url.split('?')[0],readyState:s.readyState,bufferedAmount:s.bufferedAmount})),peers:stats,activityUi:[...document.querySelectorAll('[data-media-state],[data-testid="media-state"],[data-activity-source]')].map(e=>({tag:e.tagName,text:e.textContent,source:e.getAttribute('data-activity-source')}))};
  });
}
async function fresh(u) {
  try { await u.page.waitForFunction(() => window.browserActivityMetrics?.fresh && window.browserActivityMetrics?.framesDecoded > 5, null, { timeout: 30000 }); }
  catch(error) {
    const diagnostics=[];
    for(const [index,user] of users.entries()) {
      const entry={failure:String(error),user:user.name};
      try { entry.browser=await freshDiagnostics(user); entry.browserSession=await state(user); entry.pageErrors=user.pageErrors; entry.failedRequests=user.failedRequests; } catch(e) { entry.captureError=String(e); }
      try { await user.page.screenshot({path:`${out}/fresh-timeout-${index?'B':'A'}.png`,fullPage:true}); } catch(e) { entry.screenshotError=String(e); }
      try { entry.dockerContainers=docker('ps','--format','{{.Names}} {{.Status}}'); } catch(e) { entry.dockerContainers=String(e); }
      diagnostics.push(entry);
    }
    for(const [index,entry] of diagnostics.entries())fs.writeFileSync(`${out}/fresh-timeout-${index?'B':'A'}.json`,JSON.stringify(entry,null,2));
    for(const service of ['api','worker','broker','publisher','livekit'])try { fs.writeFileSync(`${out}/fresh-timeout-${service}.log`,docker('logs','--since','10m',`${process.env.BROWSER_TEST_PROJECT||'zvonok-browser-session'}-${service}-1`)); } catch(e) { fs.writeFileSync(`${out}/fresh-timeout-${service}.log`,String(e)); }
    throw error;
  }
}
async function capture(name) { for (let i = 0; i < users.length; i++) await users[i].page.screenshot({ path: `${out}/${name}-${i ? 'B' : 'A'}.png` }); }
async function rememberVoice(u) { await u.page.evaluate(async () => {
  window.voicePCsBefore = [];
  for (const pc of window.activityPCs) if (pc.connectionState === 'connected') {
    const stats = await pc.getStats(); let audio = false, browserVideo = false;
    stats.forEach(s => { if ((s.type === 'inbound-rtp' || s.type === 'outbound-rtp') && s.kind === 'audio') audio = true; if(s.type==='inbound-rtp' && s.kind==='video')browserVideo=true; });
    // This fixture has voice-only DM peers; the separate Browser receiver also carries audio.
    if (audio && !browserVideo) window.voicePCsBefore.push(pc);
  }
  if (!window.voicePCsBefore.length) throw Error('No actual voice RTP connection');
  window.voiceCallBefore = window.activityStore.getState().call.livekitRoomName;
}); }
async function stableVoice(u) {
  const evidence=await u.page.evaluate(async()=>({roomUnchanged:window.voiceCallBefore===window.activityStore.getState().call.livekitRoomName,peers:await Promise.all(window.voicePCsBefore.map(async p=>({state:p.connectionState,rtp:[...(await p.getStats()).values()].filter(s=>s.type==='inbound-rtp'||s.type==='outbound-rtp').map(s=>({type:s.type,kind:s.kind,packetsReceived:s.packetsReceived,packetsSent:s.packetsSent}))})))}));
  if(!evidence.roomUnchanged || evidence.peers.some(p=>p.state!=='connected'))fs.writeFileSync(`${out}/voice-continuity-failure.json`,JSON.stringify(evidence,null,2));
  assert(evidence.roomUnchanged && evidence.peers.every(p=>p.state==='connected'));
}
async function bindStore(page) {
  await page.waitForFunction(() => window.activityFrames.some(s => s.startsWith('CONNECTED')));
  await page.evaluate(() => {
    const root = document.getElementById('root'), fiber = root[Object.keys(root).find(k => k.startsWith('__reactContainer$'))];
    const stack = [fiber.stateNode?.current || fiber];
    while (stack.length) { const f = stack.pop(); if (f.memoizedProps?.store?.getState) { window.activityStore = f.memoizedProps.store; return; } if (f.child) stack.push(f.child); if (f.sibling) stack.push(f.sibling); }
    throw Error('No store');
  });
}
function docker(...args) { return execFileSync('docker', ['--context', 'desktop-linux', ...args.map(arg=>arg.replace(/^zvonok-browser-session-/,`${process.env.BROWSER_TEST_PROJECT || 'zvonok-browser-session'}-`))], { encoding: 'utf8', timeout: 30000, stdio: ['pipe', 'pipe', 'pipe'] }); }
function captureXvfbEvidence() {
  const worker=`${process.env.BROWSER_TEST_PROJECT || 'zvonok-browser-session'}-worker-1`, clip=`${out}/xvfb-capture.mkv`;
  try {
    const shell=`auth=$(find /tmp -type f -name Xauthority -print -quit); test -n "$auth"; DISPLAY=:91 XAUTHORITY="$auth" ffmpeg -hide_banner -loglevel warning -threads 1 -f x11grab -framerate ${mediaProfile.fps} -video_size ${mediaProfile.width}x${mediaProfile.height} -i :91.0 -t 2 -an -c:v ffv1 -f matroska pipe:1`;
    const capture=execFileSync('docker',['--context','desktop-linux','exec',worker,'sh','-lc',shell],{timeout:30000,maxBuffer:64*1024*1024});fs.writeFileSync(clip,capture);
    const raw=execFileSync('C:/ffmpeg/bin/ffmpeg.exe',['-hide_banner','-loglevel','error','-i',clip,'-vf','crop=240:120:1024:560,scale=12:6:flags=area,format=gray','-f','rawvideo','pipe:1']);
    const pilots=execFileSync('C:/ffmpeg/bin/ffmpeg.exe',['-hide_banner','-loglevel','error','-i',clip,'-vf','crop=1:1:1010:570,format=rgb24','-f','rawvideo','pipe:1']);
    if(raw.length/72!==pilots.length/3)throw Error(`Xvfb diagnostic frame mismatch: code=${raw.length/72}, pilot=${pilots.length/3}`);
    for(let index=0;index+72<=raw.length;index+=72){const rgb=pilots.subarray(index/72*3,index/72*3+3);if(!(rgb[0]>150&&rgb[2]>150&&rgb[1]<120))continue;const decoded=require('./av-event-codec.cjs').decodeVisual(Array.from(raw.subarray(index,index+72),value=>value/255),index/72*1000/mediaProfile.fps);if(decoded.status==='decoded'){
      const frame=`${out}/xvfb-event-${decoded.eventId}.png`,select=`select=eq(n\\,${index/72})`;
      execFileSync('C:/ffmpeg/bin/ffmpeg.exe',['-hide_banner','-loglevel','error','-y','-i',clip,'-vf',select,'-frames:v','1',frame]);
      return {status:'PASS',eventId:decoded.eventId,frameIndex:index/72,confidence:decoded.confidence,pilotColor:[...rgb],clip:'xvfb-capture.mkv',frame:require('node:path').basename(frame),bytes:capture.length};
    }}
    return {status:'NO_MARKER_IN_SAMPLE',frames:Math.floor(raw.length/72),clip:'xvfb-capture.mkv',bytes:capture.length};
  } catch(error) {return {status:'CAPTURE_FAILED',error:String(error)};}
}
async function restored(u) {
  await u.page.reload(); await bindStore(u.page);
  await u.page.waitForFunction(() => window.activityStore.getState().call.mediaState === 'connected' && window.activityStore.getState().call.presentationInitialized);
  if (await u.page.evaluate(() => window.activityStore.getState().call.presentationMode !== 'expanded')) await u.page.locator('[data-call-dock] button[aria-label="Развернуть"]').click();
  const mic = u.page.locator('[data-call-stage]:not([hidden])').getByRole('button', { name: /^Микрофон: выключен/ }).first();
  if (await mic.count()) await mic.click();
  await fresh(u); await rememberVoice(u);
}
async function faults(a, b, dm) {
  const original = (await state(a)).session;
  const outsider = await http(null, '/auth/register', 'POST', { username: 'activity_out' + Date.now(), email: `activity_out${Date.now()}@example.com`, password: crypto.randomBytes(16).toString('hex') });
  const unknown = { token: outsider.accessToken };
  await http(unknown, `/calls/${callId}/browser-activity`, 'GET', undefined, 403);
  await http(unknown, `/calls/${callId}/browser-activity/${activityId}/commands`, 'POST', { op: 'join', ownerId: 1, role: 'owner' }, 403);
  const oldRoute = await fetch('http://127.0.0.1:48035/sessions', { method: 'POST', headers: { Authorization: 'Bearer legacy-does-not-authorize-Core' } }); assert.equal(oldRoute.status, 404);
  const direct = await fetch('http://127.0.0.1:48035/integration', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ assertion: 'not-a-Core-assertion' }) }); assert.equal(direct.status, 401);
  record('Valid outsider JWT cannot read/join; spoofed owner denied; legacy DEV entry and unsigned trusted entry denied');
  await b.page.evaluate(() => window.activityBrowserSockets.findLast(s => s.readyState === 1)?.close());
  await sleep(2000); await fresh(b); assert.equal((await state(b)).session.sessionId, original.sessionId);
  record('Browser signaling reconnect keeps same Session and epoch');
  await restored(b); assert.equal((await state(b)).session.sessionId, original.sessionId); await stableVoice(a);
  await restored(a); assert.equal((await state(a)).session.media.epoch, original.media.epoch); await stableVoice(b);
  record('Real guest and owner page reload reconnect through Core JWT/restore and server membership');
  docker('pause', 'zvonok-browser-session-proxy-1');
  try { await assert.rejects(command(a, 'navigate', { url: 'https://example.com/proxy-outage' })); }
  finally { docker('unpause', 'zvonok-browser-session-proxy-1'); }
  await command(a, 'navigate', { url: 'https://example.com' }); await fresh(a); await fresh(b);
  assert.equal((await state(a)).session.sessionId, original.sessionId); await stableVoice(a); await stableVoice(b);
  record('Restricted proxy outage fails navigation closed; recovery preserves Session and voice');
  const crashMedia = await command(b, 'media');
  docker('exec', 'zvonok-browser-session-worker-1', 'pkill', '-KILL', 'ffmpeg');
  await sleep(3000); await fresh(a); await fresh(b);
  assert.equal((await state(a)).session.sessionId, original.sessionId);
  assert.equal((await state(a)).session.media.epoch, original.media.epoch);
  record('Real capture crash recovers decoded video with same authorized Session and epoch');
  await command(a, 'close'); await until(async () => !(await state(a)));
  const oldGate = await fetch('http://127.0.0.1:48033/rtc/validate?access_token=' + encodeURIComponent(crashMedia.token)); assert.equal(oldGate.status, 403);
  await stableVoice(a); await stableVoice(b);
  record('Explicit closure revokes cached viewer rights after capture recovery; voice survives');
  const lostApi = await http(a, `/calls/${callId}/browser-activity`, 'POST', {}); activityId = lostApi.activityId;
  await fresh(a); const apiMedia = await command(a, 'media'); const outageAt = Date.now();
  docker('stop', '-t', '3', 'zvonok-browser-session-api-1');
  try {
    await until(async () => { const r = await fetch('http://127.0.0.1:48033/rtc/validate?access_token=' + encodeURIComponent(apiMedia.token)); return r.status === 403; }, 12000);
    await stableVoice(a); await stableVoice(b);
    record('API loss triggers independent Worker integration watchdog and media revocation', { revokeMs: Date.now() - outageAt });
  } finally { docker('start', 'zvonok-browser-session-api-1'); }
  await until(async () => (await fetch('http://127.0.0.1:48035/health')).ok);
  await until(async () => !(await state(a)));
  const next = await http(a, `/calls/${callId}/browser-activity`, 'POST', {}); activityId = next.activityId;
  await b.page.getByRole('button', { name: 'Открыть совместный браузер', exact: true }).click(); await fresh(a); await fresh(b);
  const membershipMedia = await command(b, 'media'); const revokeAt = Date.now();
  await send(a, '/app/friend/remove/' + b.name);
  await until(async () => { const r = await fetch('http://127.0.0.1:48033/rtc/validate?access_token=' + encodeURIComponent(membershipMedia.token)); return r.status === 403; });
  await http(b, `/calls/${callId}/browser-activity/${activityId}/commands`, 'POST', { op: 'media' }, 403);
  await until(async () => await b.page.locator('[data-activity-source] video').count() === 0);
  record('Actual revoked Core friendship removes viewer and rejects new media/input authorization', { revokeMs: Date.now() - revokeAt });
  const processes = docker('exec', 'zvonok-browser-session-worker-1', 'ps', '-eo', 'comm');
  assert(!/^(chrome|chromium|Xvfb|ffmpeg)$/m.test(processes));
  const profiles = docker('exec', 'zvonok-browser-session-worker-1', 'find', '/tmp', '-maxdepth', '1', '-name', 'session-profile-*'); assert.equal(profiles.trim(), '');
  const binding = docker('exec', 'zvonok-browser-session-broker-1', 'node', '-e', 'console.log(JSON.parse(require("fs").readFileSync("/binding/current.json","utf8"))===null)'); assert.equal(binding.trim(), 'true');
  fs.writeFileSync(`${out}/cleanup.json`, JSON.stringify({ noBrowserCaptureProcesses: true, profiles: profiles.trim(), brokerBinding: null }, null, 2));
  record('Actual Chromium/Xvfb/FFmpeg/profile and broker binding cleanup');
}

async function benchmark(a,b) {
  const withAudio=process.argv.includes('--audio');
  await a.page.getByRole('textbox',{name:'Адрес страницы'}).fill('https://example.com/capture-fixture');
  await a.page.getByRole('button',{name:'Перейти',exact:true}).click();
  await until(async()=>(await state(a)).session.currentUrl.includes('capture-fixture'));await fresh(a);await fresh(b);
  if(withAudio) {
    for(const u of [a,b])await u.page.getByRole('button',{name:'Включить звук сайта',exact:true}).click();
    await until(async()=>await a.page.locator('.live-surface').getAttribute('tabindex')==='0');
    await clickAt(a.page,1100,240);
    for(const u of [a,b])await until(async()=>await u.page.evaluate(()=>window.browserAudioMetrics?.totalAudioEnergy>0.001));
  } else for(const u of [a,b])assert(await u.page.getByRole('button',{name:'Включить звук сайта',exact:true}).isDisabled(),'Video-only must have no audio publication');
  await capture('benchmark-active');
  const samples=[],start=performance.now();
  while(performance.now()-start<120000) {
    samples.push({elapsedMs:performance.now()-start,at:Date.now(),a:await a.page.evaluate(()=>({video:window.browserActivityMetrics,audio:window.browserAudioMetrics})),b:await b.page.evaluate(()=>({video:window.browserActivityMetrics,audio:window.browserAudioMetrics})),voiceA:await voiceStats(a),voiceB:await voiceStats(b)});
    fs.writeFileSync(`${out}/benchmark.json`,JSON.stringify({mode:withAudio?'video+audio':'video-only',requiredMs:120000,samples},null,2));
    await sleep(2000);
  }
  await stableVoice(a); await stableVoice(b);
  assert(samples.every(s=>s.voiceA.length && s.voiceB.length),'Voice RTP connection missing during benchmark');
  for(const key of ['voiceA','voiceB'])assert(samples.at(-1)[key].reduce((n,s)=>n+s.packets,0)>samples[0][key].reduce((n,s)=>n+s.packets,0),'Voice RTP did not progress');
  await a.page.getByRole('button',{name:'Завершить для всех',exact:true}).click();await until(async()=>!(await state(a)));
  record('Controlled 120-second receiver measurement collected',{mode:withAudio?'video+audio':'video-only'});
  fs.writeFileSync(`${out}/results.json`,JSON.stringify({status:'MEASURED',rows,errors,benchmark:true},null,2));
}

async function audioCampaign(a,b,dm) {
  const original=(await state(a)).session;
  await a.page.getByRole('textbox',{name:'Адрес страницы'}).fill('https://example.com/capture-fixture');
  await a.page.getByRole('button',{name:'Перейти',exact:true}).click();
  await until(async()=>(await state(a)).session.currentUrl.includes('capture-fixture'));await fresh(a);await fresh(b);
  async function clickFixture(u) {await until(async()=>await u.page.locator('.live-surface').getAttribute('tabindex')==='0');await clickAt(u.page,1100,240);}
  async function audio(u){return u.page.evaluate(()=>window.browserAudioMetrics);}
  async function enable(u){await u.page.getByRole('button',{name:'Включить звук сайта',exact:true}).click();await until(async()=>{const m=await audio(u);return m && !m.paused;});}
  async function signal(u){await until(async()=>{const m=await audio(u);return m?.totalAudioEnergy>0.001 && m.totalSamplesReceived>4800;});}
  async function probe(u) {
    await u.page.addScriptTag({ path: avCodecPath });
    await u.page.evaluate(async()=>{
      const audio=document.querySelector('.browser-audio-controls audio');
      const context=new AudioContext();await context.resume();
      const analyser=context.createAnalyser();analyser.fftSize=512;
      const source=context.createMediaStreamSource(audio.srcObject);source.connect(analyser);
      const pcm=new Float32Array(512),canvas=document.createElement('canvas');canvas.width=1;canvas.height=1;const pixels=canvas.getContext('2d',{willReadFrequently:true});
      window.avProbe={audio:[],video:[],rms:[],identifiedAudio:[],identifiedVideo:[],invalidAudio:[],invalidVideo:[],ambiguousAudio:[],ambiguousVideo:[],frameEvidence:[],pcmEvidence:null,invalidPcmEvidence:[],clockMappings:[],context};let lastAudio=false,lastVideo=false,pcmSeen=new Map(),activeVideoId=null,invalidSeen=new Set(),ambiguousSeen=new Set();
      const detector=context.createAnalyser();detector.fftSize=32768;source.connect(detector);const pcmWindow=new Float32Array(detector.fftSize),cells=document.createElement('canvas');cells.width=12;cells.height=6;const cellContext=cells.getContext('2d',{willReadFrequently:true});
      window.avProbe.timer=setInterval(()=>{
        analyser.getFloatTimeDomainData(pcm);const rms=Math.sqrt(pcm.reduce((sum,v)=>sum+v*v,0)/pcm.length),now=performance.now();
        const v=document.querySelector('[data-activity-source] video');if(!v?.videoWidth)return;
        pixels.drawImage(v,1220,20,1,1,0,0,1,1);const pixel=pixels.getImageData(0,0,1,1).data;
        const tone=rms>0.04,flash=pixel[0]>180 && pixel[1]>180 && pixel[2]>180;
        if(tone && !lastAudio)window.avProbe.audio.push(now);if(flash && !lastVideo)window.avProbe.video.push(now);
        lastAudio=tone;lastVideo=flash;
        detector.getFloatTimeDomainData(pcmWindow);const timestamp=context.getOutputTimestamp?.(),audioEndAt=timestamp?.performanceTime+(context.currentTime-timestamp.contextTime)*1000||now,baseAt=audioEndAt-pcmWindow.length*1000/context.sampleRate;if(window.avProbe.clockMappings.length<10)window.avProbe.clockMappings.push({at:now,contextTime:context.currentTime,performanceTime:timestamp?.performanceTime??null,outputContextTime:timestamp?.contextTime??null,outputTimestampAgeMs:timestamp?now-timestamp.performanceTime:null,audioEndAt});
        const audioDetections=window.AvEventCodec.detectAudio(pcmWindow,context.sampleRate,{at:baseAt});
        for(const event of audioDetections.events){const previousAt=pcmSeen.get(event.eventId);if(previousAt===undefined||Math.abs(event.at-previousAt)>500){pcmSeen.set(event.eventId,event.at);window.avProbe.identifiedAudio.push({...event,detectionAt:now,latencyUncertaintyMs:5,mediaType:'audio'});if(!window.avProbe.pcmEvidence){const sampleStart=Math.max(0,Math.round((event.at-baseAt)*context.sampleRate/1000)),sampleEnd=Math.min(pcmWindow.length,sampleStart+Math.round(.64*context.sampleRate)),samples=pcmWindow.slice(sampleStart,sampleEnd),bytes=new Uint8Array(samples.buffer),parts=[];for(let i=0;i<bytes.length;i+=8192)parts.push(String.fromCharCode(...bytes.subarray(i,i+8192)));window.avProbe.pcmEvidence={eventId:event.eventId,sampleRate:context.sampleRate,format:'f32le',sampleStartAt:event.at,sampleCount:samples.length,base64:btoa(parts.join(''))};}}}
        for(const event of audioDetections.invalid){const key=`${event.reason}:${Math.round(event.at/640)}`;if(!invalidSeen.has(key)){invalidSeen.add(key);window.avProbe.invalidAudio.push({...event,mediaType:'audio'});if(window.avProbe.invalidPcmEvidence.length<3){const start=Math.max(0,Math.round((event.at-baseAt)*context.sampleRate/1000)),samples=pcmWindow.slice(start,Math.min(pcmWindow.length,start+Math.round(.64*context.sampleRate))),bytes=new Uint8Array(samples.buffer),parts=[];for(let i=0;i<bytes.length;i+=8192)parts.push(String.fromCharCode(...bytes.subarray(i,i+8192)));window.avProbe.invalidPcmEvidence.push({reason:event.reason,at:event.at,sampleRate:context.sampleRate,sampleCount:samples.length,base64:btoa(parts.join(''))});}}}
        for(const event of audioDetections.ambiguous){const key=`${event.reason}:${Math.round(event.at/640)}`;if(!ambiguousSeen.has(key)){ambiguousSeen.add(key);window.avProbe.ambiguousAudio.push({...event,mediaType:'audio'});}}
        pixels.drawImage(v,1010,570,1,1,0,0,1,1);const pilot=pixels.getImageData(0,0,1,1).data,pilotColor=[pilot[0],pilot[1],pilot[2]],markerPresent=pilot[0]>150&&pilot[2]>150&&pilot[1]<120;
        if(markerPresent){cellContext.drawImage(v,1024,560,240,120,0,0,12,6);const image=cellContext.getImageData(0,0,12,6),luma=Array.from({length:72},(_,i)=>(.2126*image.data[i*4]+.7152*image.data[i*4+1]+.0722*image.data[i*4+2])/255),decoded=window.AvEventCodec.decodeVisual(luma,now);if(decoded.status==='decoded'){if(activeVideoId!==decoded.eventId){const detectionLatencyMs=(1000/15+100)/2;window.avProbe.identifiedVideo.push({...decoded,at:now-detectionLatencyMs,detectionAt:now,detectionLatencyMs,latencyUncertaintyMs:detectionLatencyMs,pilotColor,mediaType:'video'});activeVideoId=decoded.eventId;if(window.avProbe.frameEvidence.length<3){const frame=document.createElement('canvas');frame.width=v.videoWidth;frame.height=v.videoHeight;frame.getContext('2d').drawImage(v,0,0);window.avProbe.frameEvidence.push({eventId:decoded.eventId,detectionAt:now,pilotColor,png:frame.toDataURL('image/png')});}}}else if(decoded.status==='ambiguous'){const key=Math.round(now/500);if(!ambiguousSeen.has(key)){ambiguousSeen.add(key);window.avProbe.ambiguousVideo.push({at:now,reason:decoded.reason,confidence:decoded.confidence,mediaType:'video'});}}else{const key=Math.round(now/500);if(!invalidSeen.has(key)){invalidSeen.add(key);window.avProbe.invalidVideo.push({at:now,reason:decoded.reason,mediaType:'video'});}}}else activeVideoId=null;
        window.avProbe.rms.push({at:now,rms});if(window.avProbe.rms.length>4000)window.avProbe.rms.shift();
      },100);
    });
  }
  async function stopProbe(u){return u.page.evaluate(async()=>{const p=window.avProbe;clearInterval(p.timer);await p.context.close();return {audio:p.audio,video:p.video,rms:p.rms,identifiedAudio:p.identifiedAudio,identifiedVideo:p.identifiedVideo,invalidAudio:p.invalidAudio,invalidVideo:p.invalidVideo,ambiguousAudio:p.ambiguousAudio,ambiguousVideo:p.ambiguousVideo,frameEvidence:p.frameEvidence,pcmEvidence:p.pcmEvidence,invalidPcmEvidence:p.invalidPcmEvidence,clockMappings:p.clockMappings};});}
  await enable(a);await enable(b);await clickFixture(a);await probe(a);await probe(b);await signal(a);await signal(b);
  const xvfbEvidence=captureXvfbEvidence();fs.writeFileSync(`${out}/capture-stages.json`,JSON.stringify({fixtureChromium:'chromium-marker.png in event-id-validation',xvfb:xvfbEvidence,publisher:'fresh outbound video RTP; receiver frame files follow'},null,2));await capture('audio-focus');
  record('A/B real browser PCM decoded, nonzero energy and explicit playback', {a:await audio(a),b:await audio(b)});
  await a.page.getByRole('button',{name:'Выключить звук сайта',exact:true}).click();
  assert((await a.page.locator('.browser-audio-controls audio').evaluate(e=>e.paused)));
  assert(!(await b.page.locator('.browser-audio-controls audio').evaluate(e=>e.paused)));
  await enable(a);
  for(const [u,volume]of [[a,'30'],[b,'80']]) {
    await u.page.locator('.browser-audio-controls summary').click();
    await u.page.getByRole('slider',{name:'Громкость сайта'}).fill(volume);
  }
  await until(async()=>await a.page.locator('.browser-audio-controls audio').evaluate(e=>Math.abs(e.volume-0.3)<0.01));
  await until(async()=>await b.page.locator('.browser-audio-controls audio').evaluate(e=>Math.abs(e.volume-0.8)<0.01));
  assert.equal(await a.page.locator('.browser-audio-controls audio').evaluate(e=>e.volume),0.3);
  assert.equal(await b.page.locator('.browser-audio-controls audio').evaluate(e=>e.volume),0.8);
  await capture('volume-popover');
  for(const u of [a,b]) await u.page.locator('.browser-audio-controls summary').click();
  for(const u of [a,b]) { await u.page.setViewportSize({width:1024,height:768}); await u.page.emulateMedia({reducedMotion:'reduce'}); }
  await capture('narrow-1024');
  for(const u of [a,b]) assert(await u.page.locator('[data-activity-source]').evaluate(e=>e.scrollWidth<=e.clientWidth),'Browser panel horizontal overflow at1024');
  await a.page.locator('.live-surface').focus(); await a.page.keyboard.press('Escape');
  assert(await a.page.getByRole('button',{name:'Переподключить видео',exact:true}).evaluate(e=>e===document.activeElement));
  for(const u of [a,b]) { await u.page.setViewportSize({width:1440,height:960}); await u.page.emulateMedia({reducedMotion:'no-preference'}); }
  record('A mute/enable and independent A30/B80 local volume');
  const avDuration=Number(process.argv.find(arg=>arg.startsWith('--av-ms='))?.split('=')[1])||70000,duration=process.argv.includes('--soak')?600000:process.argv.includes('--av-only')?avDuration:35000,samples=[],gaps=[];
  fs.writeFileSync(`${out}/resources-before.jsonl`,docker('stats','--no-stream','--format','{{json .}}','zvonok-browser-session-worker-1','zvonok-browser-session-publisher-1','zvonok-browser-session-livekit-1'));
  let nextActivity=60000;const presence=[];
  const collect=async()=>{
    const requestedAt=performance.now();
    const [audioA,audioB,videoA,videoB]=await Promise.all([audio(a),audio(b),a.page.evaluate(()=>window.browserActivityMetrics),b.page.evaluate(()=>window.browserActivityMetrics)]);
    const completedAt=performance.now(),sampledWallAtMs=Date.now();
    return {collectorDurationMs:completedAt-requestedAt,sampledAtMonoMs:completedAt,sampledWallAtMs,a:audioA,b:audioB,videoA,videoB};
  };
  // Readiness work is outside the acceptance window; this first completed sample starts it.
  await until(async()=>{
    const [audioA,audioB,videoA,videoB]=await Promise.all([audio(a),audio(b),a.page.evaluate(()=>window.browserActivityMetrics),b.page.evaluate(()=>window.browserActivityMetrics)]);
    return audioA?.totalSamplesReceived>4800&&audioB?.totalSamplesReceived>4800&&audioA?.totalAudioEnergy>0&&audioB?.totalAudioEnergy>0&&videoA?.fresh&&videoB?.fresh;
  });
  const first=await collect(),start=first.sampledAtMonoMs;
  first.elapsedMs=0;samples.push(first);
  while(performance.now()-start<duration) {
    if(process.argv.includes('--active-input') && performance.now()-start>=nextActivity) {
      const before=(await state(a)).session, box=await a.page.locator('.live-surface').boundingBox();assert(box,'Visible activity surface');
      await a.page.mouse.move(box.x+box.width*(nextActivity%120000?0.4:0.6),box.y+box.height*0.5);
      await until(async()=>Date.parse((await state(a)).session.lastActivityAt)>Date.parse(before.lastActivityAt));
      const after=(await state(a)).session;assert.equal(after.expiresAt,before.expiresAt,'Input must not extend absolute TTL');
      presence.push({at:Date.now(),lastActivityAt:after.lastActivityAt,idleExpiresAt:after.idleExpiresAt,expiresAt:after.expiresAt});
      fs.writeFileSync(`${out}/active-input.json`,JSON.stringify(presence,null,2));nextActivity+=60000;
    }
    const sleepStarted=performance.now();await sleep(2000);const sample=await collect();sample.elapsedMs=sample.sampledAtMonoMs-start;sample.samplingDelayMs=2000;sample.samplingOvershootMs=performance.now()-sleepStarted-2000;samples.push(sample);
    fs.writeFileSync(`${out}/soak.json`,JSON.stringify(samples,null,2));
    if(!sample.a || !sample.b || !sample.videoA?.fresh || !sample.videoB?.fresh) {
      const gap={at:Date.now(),elapsedMs:sample.elapsedMs,a:!!sample.a,b:!!sample.b,videoA:!!sample.videoA?.fresh,videoB:!!sample.videoB?.fresh};gaps.push(gap);fs.writeFileSync(`${out}/gaps.json`,JSON.stringify(gaps,null,2));
      await capture(`gap-${Math.round(sample.elapsedMs)}`);
      fs.writeFileSync(`${out}/gap-state.json`,JSON.stringify({at:Date.now(),a:await state(a),b:await state(b),textA:await a.page.locator('[data-activity-source]').textContent().catch(()=>null),textB:await b.page.locator('[data-activity-source]').textContent().catch(()=>null)},null,2));
      await fresh(a);await fresh(b);await until(async()=>!!(await audio(a)) && !!(await audio(b)),20000);gap.recoveryMs=Date.now()-gap.at;
      const recovered=await collect();recovered.elapsedMs=recovered.sampledAtMonoMs-start;recovered.samplingDelayMs=0;recovered.samplingOvershootMs=0;samples.push(recovered);
      fs.writeFileSync(`${out}/soak.json`,JSON.stringify(samples,null,2));
      continue;
    }
    assert(sample.a.totalAudioEnergy>0 && sample.b.totalAudioEnergy>0);
    if(samples.length>1)for(const key of ['a','b']){const previous=samples.at(-2)[key];if(previous && previous.trackSid===sample[key].trackSid)assert(sample[key].totalSamplesReceived>previous.totalSamplesReceived,'Browser decoded samples must progress');}
    if(samples.length%15===0)console.table([{elapsedSec:Math.round(sample.elapsedMs/1000),aSamples:sample.a.totalSamplesReceived,bSamples:sample.b.totalSamplesReceived}]);
  }
  const av={a:await stopProbe(a),b:await stopProbe(b)};
  for(const [key,p] of Object.entries(av)){for(const [i,frame] of p.frameEvidence.entries())fs.writeFileSync(`${out}/receiver-${key}-frame-${i}-event-${frame.eventId}.png`,Buffer.from(frame.png.slice(frame.png.indexOf(',')+1),'base64'));if(p.pcmEvidence){const pcm=Buffer.from(p.pcmEvidence.base64,'base64');delete p.pcmEvidence.base64;fs.writeFileSync(`${out}/receiver-${key}-event-${p.pcmEvidence.eventId}.f32le`,pcm);fs.writeFileSync(`${out}/receiver-${key}-audio-sample.json`,JSON.stringify(p.pcmEvidence,null,2));}for(const [i,sample] of p.invalidPcmEvidence.entries()){fs.writeFileSync(`${out}/receiver-${key}-invalid-audio-${i}.f32le`,Buffer.from(sample.base64,'base64'));delete sample.base64;}fs.writeFileSync(`${out}/receiver-${key}-audio-clock.json`,JSON.stringify(p.clockMappings,null,2));delete p.frameEvidence;delete p.pcmEvidence;delete p.invalidPcmEvidence;delete p.clockMappings;}
  fs.writeFileSync(`${out}/resources-after.jsonl`,docker('stats','--no-stream','--format','{{json .}}','zvonok-browser-session-worker-1','zvonok-browser-session-publisher-1','zvonok-browser-session-livekit-1'));
  for(const p of Object.values(av)){p.offsets=p.video.map(t=>{const closest=p.audio.reduce((a,b)=>Math.abs(b-t)<Math.abs(a-t)?b:a,Infinity);return t-closest;}).filter(x=>Math.abs(x)<600);const sorted=p.offsets.map(Math.abs).sort((a,b)=>a-b);p.p95AbsoluteMs=sorted[Math.floor(sorted.length*0.95)];p.cadenceDiagnostic=analyzeEvents(p);p.identifiedEventDiagnostic=require('./av-event-codec.cjs').matchIdentifiedEvents({audio:p.identifiedAudio,video:p.identifiedVideo,invalidAudio:p.invalidAudio,invalidVideo:p.invalidVideo,ambiguousAudio:p.ambiguousAudio,ambiguousVideo:p.ambiguousVideo});}
  fs.writeFileSync(`${out}/av.json`,JSON.stringify(av,null,2));
  const mediaAcceptance=evaluateMediaAcceptance(samples,{requiredDurationMs:duration,profile:mediaProfile.name});
  fs.writeFileSync(`${out}/media-acceptance.json`,JSON.stringify(mediaAcceptance,null,2));
  record('Continuous actual two-client browser A/V campaign',{status:mediaAcceptance.status,durationMs:performance.now()-start,gaps});
  record('Observed A/V sync (not physical output)',{status:av.a.p95AbsoluteMs<=150 && av.b.p95AbsoluteMs<=150?'PASS':'FAIL',avA:av.a.p95AbsoluteMs,avB:av.b.p95AbsoluteMs,criterion:'p95<=150ms; uncertainty not calibrated'});
  const idDiagnostics=[av.a.identifiedEventDiagnostic,av.b.identifiedEventDiagnostic],identifiedStatus=idDiagnostics.some(d=>d.status==='INCONCLUSIVE')?'INCONCLUSIVE':idDiagnostics.every(d=>d.p95AbsoluteMs<=150)?'PASS':'FAIL';
  record('Identified source-event diagnostic (separate; not physical output)',{status:identifiedStatus,a:{status:av.a.identifiedEventDiagnostic.status,pairs:av.a.identifiedEventDiagnostic.coverage,missingAudio:av.a.identifiedEventDiagnostic.missingAudio.length,missingVideo:av.a.identifiedEventDiagnostic.missingVideo.length,duplicates:av.a.identifiedEventDiagnostic.duplicates,invalidAudio:av.a.identifiedEventDiagnostic.invalidAudio.length,invalidVideo:av.a.identifiedEventDiagnostic.invalidVideo.length,ambiguous:av.a.identifiedEventDiagnostic.ambiguous.length,p50AbsoluteMs:av.a.identifiedEventDiagnostic.p50AbsoluteMs,p95AbsoluteMs:av.a.identifiedEventDiagnostic.p95AbsoluteMs,uncertaintyMs:av.a.identifiedEventDiagnostic.uncertaintyMs,driftMsPerMinute:av.a.identifiedEventDiagnostic.driftMsPerMinute},b:{status:av.b.identifiedEventDiagnostic.status,pairs:av.b.identifiedEventDiagnostic.coverage,missingAudio:av.b.identifiedEventDiagnostic.missingAudio.length,missingVideo:av.b.identifiedEventDiagnostic.missingVideo.length,duplicates:av.b.identifiedEventDiagnostic.duplicates,invalidAudio:av.b.identifiedEventDiagnostic.invalidAudio.length,invalidVideo:av.b.identifiedEventDiagnostic.invalidVideo.length,ambiguous:av.b.identifiedEventDiagnostic.ambiguous.length,p50AbsoluteMs:av.b.identifiedEventDiagnostic.p50AbsoluteMs,p95AbsoluteMs:av.b.identifiedEventDiagnostic.p95AbsoluteMs,uncertaintyMs:av.b.identifiedEventDiagnostic.uncertaintyMs,driftMsPerMinute:av.b.identifiedEventDiagnostic.driftMsPerMinute}});
  if(process.argv.includes('--av-only')){fs.writeFileSync(`${out}/results.json`,JSON.stringify({status:'MEASURED_NOT_ACCEPTANCE',identifiedStatus,xvfbEvidence,mediaAcceptance,avOffsets:{a:av.a.p95AbsoluteMs,b:av.b.p95AbsoluteMs},identifiedEventDiagnostic:{a:av.a.identifiedEventDiagnostic,b:av.b.identifiedEventDiagnostic},physicalListening:'NOT RUN'},null,2));return;}
  const starvationBefore={session:(await state(a)).session,a:await audio(a),b:await audio(b)};
  const chromePids=docker('exec','zvonok-browser-session-worker-1','pgrep','-x','chrome').trim().split(/\s+/);assert(chromePids.length && chromePids.every(pid=>/^\d+$/.test(pid)));
  docker('exec','zvonok-browser-session-worker-1','kill','-STOP',...chromePids);
  try {await sleep(1000);} finally {docker('exec','zvonok-browser-session-worker-1','kill','-CONT',...chromePids);}
  await fresh(a);await fresh(b);
  await until(async()=>{const x=await audio(a),y=await audio(b);return x?.totalSamplesReceived>starvationBefore.a.totalSamplesReceived && y?.totalSamplesReceived>starvationBefore.b.totalSamplesReceived && x.totalAudioEnergy>starvationBefore.a.totalAudioEnergy && y.totalAudioEnergy>starvationBefore.b.totalAudioEnergy;});
  const starvationAfter={session:(await state(a)).session,a:await audio(a),b:await audio(b)};
  assert.equal(starvationAfter.session.sessionId,starvationBefore.session.sessionId);
  assert.equal(starvationAfter.session.collaboration.generation,starvationBefore.session.collaboration.generation);
  fs.writeFileSync(`${out}/chromium-starvation.json`,JSON.stringify({chromePids,pauseMs:1000,before:starvationBefore,after:starvationAfter},null,2));
  record('Temporary Chromium process starvation resumes decoded audio/video in the same session');
  await b.page.getByRole('button',{name:'Запросить управление',exact:true}).click();
  await a.page.getByRole('button',{name:'Отклонить',exact:true}).waitFor(); await capture('control-request');
  await a.page.getByRole('button',{name:'Отклонить',exact:true}).click();
  await b.page.getByText('Запрос управления отклонён. Можно продолжить просмотр.',{exact:true}).waitFor(); await capture('control-declined');
  await b.page.getByRole('button',{name:'Запросить управление',exact:true}).click();await a.page.getByRole('button',{name:'Передать',exact:true}).click();
  await until(async()=>{const c=(await state(b)).session.collaboration;return c.controller===c.identity;});
  await clickFixture(b);await sleep(2500);const silentBefore={a:await audio(a),b:await audio(b)};await sleep(2500);const silentAfter={a:await audio(a),b:await audio(b)};
  fs.writeFileSync(`${out}/silence.json`,JSON.stringify({silentBefore,silentAfter},null,2));
  for(const key of ['a','b'])assert(silentAfter[key].totalAudioEnergy-silentBefore[key].totalAudioEnergy<0.001,'Controlled silence energy');
  await clickFixture(b);await sleep(2500);record('Guest control starts/stops real Chromium sound; controlled receiver silence');
  await a.page.getByRole('button',{name:'Переписка звонка',exact:true}).click();await capture('audio-split');
  await a.page.locator('[data-call-stage]:not([hidden])').getByRole('button',{name:'Свернуть звонок',exact:true}).click();await until(async()=>await a.page.locator('.browser-audio-controls audio').count()===0);await stableVoice(a);await stableVoice(b);await capture('audio-compact');
  await a.page.getByRole('button',{name:'Развернуть',exact:true}).click();await fresh(a);assert(await a.page.locator('.browser-audio-controls audio').evaluate(e=>e.paused));await enable(a);
  await a.page.getByRole('button',{name:'Кино',exact:true}).click();await capture('audio-cinema');await a.page.keyboard.press('Escape');
  assert.equal(await a.page.locator('.browser-audio-controls audio').count(),1);
  record('Focus/Split/Cinema single audio owner; Compact stops playback and restore requires gesture');
  const beforeRecovery=(await state(a)).session.collaboration;
  docker('exec','zvonok-browser-session-worker-1','sh','-c',"ps -eo pid,args | awk '/ffmpeg/ && /x11grab/ && !/awk/ {print $1}' | xargs -r kill -STOP");
  await sleep(2500); await capture('media-recovery'); await sleep(3500);await fresh(a);await fresh(b);assert.equal((await state(a)).session.sessionId,original.sessionId);
  const afterRecovery=(await state(a)).session.collaboration;assert.equal(afterRecovery.controller,beforeRecovery.controller);assert.equal(afterRecovery.generation,beforeRecovery.generation);
  record('SIGSTOP x11grab recovery preserves Chromium/Session/control lease');
  docker('restart','-t','3','zvonok-browser-session-publisher-1');await sleep(6000);await fresh(a);await fresh(b);await signal(a);await signal(b);
  assert.equal(await a.page.locator('.browser-audio-controls audio').count(),1);record('Publisher restart restores shared A/V without duplicate element');
  const oldGuest=await command(b,'media');await b.page.getByRole('button',{name:'Покинуть браузер',exact:true}).click();await until(async()=>!(await state(b)).joined);
  assert.equal((await fetch('http://127.0.0.1:48033/rtc/validate?access_token='+encodeURIComponent(oldGuest.token))).status,403);
  await b.page.getByRole('button',{name:'Активности',exact:true}).click();await b.page.getByRole('button',{name:'Совместный браузер',exact:true}).click();await fresh(b);await enable(b);await signal(b);
  const old=await command(a,'media'),voiceBefore=await voiceStats(a);await a.page.getByRole('button',{name:'Завершить для всех',exact:true}).click();await until(async()=>!(await state(a)));await sleep(2000);await stableVoice(a);await stableVoice(b);
  const voiceAfter=await voiceStats(a);assert(voiceAfter.reduce((s,v)=>s+v.bytes,0)>voiceBefore.reduce((s,v)=>s+v.bytes,0));
  assert.equal((await fetch('http://127.0.0.1:48033/rtc/validate?access_token='+encodeURIComponent(old.token))).status,403);
  const processes=docker('exec','zvonok-browser-session-worker-1','ps','-eo','comm');assert(!/^(chrome|chromium|Xvfb|ffmpeg|pulseaudio)$/m.test(processes));
  assert.equal(docker('exec','zvonok-browser-session-broker-1','node','-e','console.log(JSON.parse(require("fs").readFileSync("/binding/current.json","utf8"))===null)').trim(),'true');
  record('Guest revoke/rejoin; close removes Pulse/Chromium/capture and RoomService binding; voice RTP grows',{voiceBefore,voiceAfter});
  await http(a,'/calls/end','POST',{callId,chatRoomId:dm.id});
  assert.equal(mediaAcceptance.status,'PASS','Media continuity/FPS gate failed; see media-acceptance.json');
  assert(av.a.p95AbsoluteMs<=150 && av.b.p95AbsoluteMs<=150,'Observed A/V sync gate failed; see av.json');
  fs.writeFileSync(`${out}/results.json`,JSON.stringify({status:'PASS',rows,errors,mediaAcceptance,syntheticMicrophones:true,physicalListening:'NOT RUN',avCriterion:av.a.p95AbsoluteMs<=150 && av.b.p95AbsoluteMs<=150?'OBSERVED_PASS_NOT_PHYSICAL':'FAIL_OR_UNVERIFIED'},null,2));
}

(async () => {
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: process.env.BROWSER_TEST_HEADED !== '1', args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', ...(process.argv.includes('--audio')?[]:['--autoplay-policy=no-user-gesture-required'])] });
    const suffix = Date.now().toString().slice(-9), a = await login('activity_a' + suffix), b = await login('activity_b' + suffix);
    record('Two real Core registrations and UI logins; independent JWTs', { clients: users.map(u => u.client) });
    await send(a, '/app/friend/send/' + b.name);
    const request = await until(async () => (await http(b, '/friends/requests/incoming'))[0]);
    await send(b, '/app/friend/accept/' + request.requestId);
    const dm = await until(async () => (await http(a, '/rooms/all')).find(r => r.type === 'PRIVATE'));
    record('Friendship and PRIVATE DM created through authorized application APIs', { roomId: dm.id });
    for (const u of [a, b]) { await u.page.goto(`${base}/dm?roomId=${dm.id}`); await bindStore(u.page); }
    await sleep(700);
    await a.page.getByRole('button', { name: 'Начать звонок', exact: true }).click();
    await b.page.getByRole('button', { name: 'Принять', exact: true }).click();
    for (const u of [a, b]) {
      await u.page.waitForFunction(() => window.activityStore.getState().call.mediaState === 'connected' && window.activityStore.getState().call.presentationInitialized);
      if (await u.page.evaluate(() => window.activityStore.getState().call.presentationMode !== 'expanded'))
        await u.page.locator('[data-call-dock] button[aria-label="Развернуть"]').click();
      const mic = u.page.locator('[data-call-stage]:not([hidden])').getByRole('button', { name: /^Микрофон: выключен/ }).first();
      await mic.click();
      await u.page.locator('[data-call-stage]:not([hidden])').getByRole('button', { name: /^Микрофон: включён/ }).first().waitFor();
    }
    callId = await a.page.evaluate(() => window.activityStore.getState().call.callId);
    await until(async () => (await voiceStats(a)).some(s => s.packets > 10) && (await voiceStats(b)).some(s => s.packets > 10));
    await rememberVoice(a); await rememberVoice(b);
    record('Actual DM call and bidirectional microphone RTP (synthetic test microphone)', { callId, a: await voiceStats(a), b: await voiceStats(b) });
    await capture('normal-dm-call');
    await a.page.getByRole('button', { name: 'Активности', exact: true }).click();
    await capture('activity-selection');
    await a.page.keyboard.press('Escape');
    assert.equal(await a.page.getByRole('button',{name:'Активности',exact:true}).evaluate(e=>e===document.activeElement),true);
    await a.page.getByRole('button', { name: 'Активности', exact: true }).click();
    await a.page.getByRole('button', { name: 'Совместный браузер', exact: true }).click();
    await capture('browser-starting');
    const created = await until(async () => { const activity = await state(a); return activity?.activityId ? activity : null; });
    const sequence={createInvite:{at:Date.now(),owner:created,guest:await state(b)}};activityId=sequence.createInvite.owner.activityId;
    await b.page.getByRole('button', { name: 'Открыть совместный браузер', exact: true }).click({ timeout: 30000 });
    await fresh(a); await fresh(b);
    sequence.join={at:Date.now(),owner:await state(a),guest:await state(b)};
    sequence.publisher={service:docker('ps','--format','{{.Names}} {{.Status}}').split('\n').filter(line=>line.includes('-publisher-'))};
    sequence.receivers={a:await a.page.evaluate(()=>window.browserActivityMetrics??null),b:await b.page.evaluate(()=>window.browserActivityMetrics??null)};
    sequence.firstDecodedFrame={a:sequence.receivers.a?.framesDecoded>5,b:sequence.receivers.b?.framesDecoded>5};
    fs.writeFileSync(`${out}/browser-session-flow.json`,JSON.stringify(sequence,null,2)); activityId = sequence.join.owner.activityId;
    record('One BrowserSession, owner create, unobtrusive invite, guest join, two decoded viewers');
    await capture('browser-connected');
    if (process.argv.includes('--startup-cycles')) {
      const cycles = [];
      for (let index = 0; index < 8; index++) {
        await a.page.getByRole('button', { name: 'Завершить для всех', exact: true }).click();
        await until(async () => !(await state(a)));
        await until(async () => !/^(chrome|chromium|Xvfb|ffmpeg|pulseaudio)$/m.test(docker('exec', 'zvonok-browser-session-worker-1', 'ps', '-eo', 'comm')));
        const start = performance.now();
        await a.page.getByRole('button', { name: 'Активности', exact: true }).click();
        await a.page.getByRole('button', { name: 'Совместный браузер', exact: true }).click();
        await b.page.getByRole('button', { name: 'Открыть совместный браузер', exact: true }).click({ timeout: 30000 });
        await fresh(a); await fresh(b);
        activityId = (await state(a)).activityId;
        cycles.push({ index, at: Date.now(), createJoinDecodedMs: performance.now() - start, cleanup: 'PASS' });
        fs.writeFileSync(`${out}/startup-cycles.json`, JSON.stringify(cycles, null, 2));
      }
      await a.page.getByRole('button', { name: 'Завершить для всех', exact: true }).click();
      await until(async () => !(await state(a)));
      record('Eight sequential UI create/join/close cycles', { cycles });
      fs.writeFileSync(`${out}/results.json`, JSON.stringify({ status: 'PASS', rows, errors }, null, 2));
      return;
    }
    if (process.argv.includes('--faults')) {
      await faults(a, b, dm); await capture('faults-complete');
      fs.writeFileSync(`${out}/results.json`, JSON.stringify({ status: 'PASS', rows, errors, mode: 'faults', syntheticMicrophones: true }, null, 2));
      return;
    }
    if(process.argv.includes('--benchmark')){await benchmark(a,b);return;}
    if(process.argv.includes('--audio')){await audioCampaign(a,b,dm);return;}
    let oldMedia = await command(b, 'media');
    await a.page.getByRole('textbox', { name: 'Адрес страницы' }).fill('https://www.selenium.dev/selenium/web/web-form.html');
    await a.page.getByRole('button', { name: 'Перейти', exact: true }).click();
    await until(async () => (await state(a)).session.currentUrl.includes('web-form.html'));
    await capture('focus');
    const before = await a.page.evaluate(() => window.browserActivityMetrics);
    const beforeB = await b.page.evaluate(() => window.browserActivityMetrics);
    const voiceBefore = { a: await voiceStats(a), b: await voiceStats(b) }, samples = [];
    for (let i = 0; i < 25; i++) {
      await sleep(1000);
      const sample = { a: await a.page.evaluate(() => window.browserActivityMetrics), b: await b.page.evaluate(() => window.browserActivityMetrics) };
      samples.push(sample);
    }
    const afterA = await a.page.evaluate(() => window.browserActivityMetrics), afterB = await b.page.evaluate(() => window.browserActivityMetrics);
    fs.writeFileSync(`${out}/measurements.json`, JSON.stringify({ before, beforeB, afterA, afterB, samples, voiceBefore, voiceAfter: { a: await voiceStats(a), b: await voiceStats(b) } }, null, 2));
    for (let i = 0; i < samples.length; i++) for (const key of ['a','b']) {
      assert(samples[i][key]?.fresh && samples[i][key].publications === 1);
      if (!process.argv.includes('--functional')) assert(samples[i][key].framesDecoded > (i ? samples[i - 1][key].framesDecoded : key === 'a' ? before.framesDecoded : beforeB.framesDecoded));
    }
    const fpsA = (afterA.framesDecoded - before.framesDecoded) * 1000 / (afterA.at - before.at);
    const fpsB = (afterB.framesDecoded - beforeB.framesDecoded) * 1000 / (afterB.at - beforeB.at);
    if (!process.argv.includes('--functional')) assert(fpsA >= mediaProfile.fps*0.95 && fpsB >= mediaProfile.fps*0.95, `Decoded ${mediaProfile.name} FPS below target: A=${fpsA} B=${fpsB}`);
    assert(afterA.framesDecoded > before.framesDecoded && afterB.framesDecoded > beforeB.framesDecoded);
    assert.equal(afterA.width, mediaProfile.width); assert.equal(afterA.height, mediaProfile.height); assert.equal(afterB.width, mediaProfile.width); assert.equal(afterB.height, mediaProfile.height);
    record(process.argv.includes('--functional') ? `Two fresh ${mediaProfile.name} viewers (functional only; no FPS gate)` : `Continuous ${mediaProfile.name} decoded video`, { a: afterA, b: afterB, fpsA, fpsB, framesDelta: afterA.framesDecoded - before.framesDecoded, seconds: (afterA.at - before.at) / 1000 });
    fs.writeFileSync(`${out}/resources.jsonl`, docker('stats', '--no-stream', '--format', '{{json .}}', 'zvonok-browser-session-worker-1', 'zvonok-browser-session-publisher-1', 'zvonok-browser-session-livekit-1'));
    await b.page.getByRole('button', { name: 'Запросить управление', exact: true }).click();
    await a.page.getByRole('button', { name: 'Передать', exact: true }).click();
    await until(async () => { const s = (await state(b)).session.collaboration; return s.controller === s.identity; });
    const stale = await state(b);
    await b.page.getByRole('button', { name: 'Вернуть управление хозяину', exact: true }).waitFor();
    await clickAt(b.page,160,134);
    await b.page.keyboard.type('Core Activity input', { delay: 60 }); await sleep(500);
    await capture('guest-controls');
    const queued = Array.from({ length: 8 }, () => command(b, 'input', { type: 'text', text: 'q' }, stale).then(() => 'ok', () => 'rejected'));
    await a.page.getByRole('button', { name: 'Вернуть управление', exact: true }).click();
    const queueResults = await Promise.all(queued);
    await assert.rejects(command(b, 'input', { type: 'text', text: 'stale' }, stale));
    record('Server lease transfer, guest click/type, owner revoke during queued input, stale fence denied', { queueResults });
    await a.page.getByRole('button', { name: 'Переписка звонка', exact: true }).click();
    const divider = a.page.getByRole('separator', { name: 'Пропорции браузера и чата' }); await divider.focus(); await divider.press('ArrowLeft');
    await capture('split');
    const original = (await state(a)).session;
    await a.page.locator('[data-call-stage]:not([hidden])').getByRole('button', { name: 'Свернуть звонок', exact: true }).click();
    await until(async () => await a.page.locator('[data-activity-source] video').count() === 0);
    await stableVoice(a); await stableVoice(b); await capture('compact');
    await a.page.getByRole('button', { name: 'Развернуть', exact: true }).click(); await fresh(a);
    assert.equal((await state(a)).session.sessionId, original.sessionId); assert.equal((await state(a)).session.media.epoch, original.media.epoch);
    assert.equal((await state(a)).session.collaboration.controller, original.collaboration.controller);
    assert.equal((await state(a)).session.collaboration.generation, original.collaboration.generation);
    await a.page.getByRole('button', { name: 'Кино', exact: true }).click(); await capture('cinema');
    await a.page.keyboard.press('Escape'); await stableVoice(a); await stableVoice(b);
    record('Focus / resizable Split / Compact / Cinema retain BrowserSession, epoch and voice peer connections');
    await b.page.getByRole('button', { name: 'Покинуть браузер', exact: true }).click();
    await until(async () => !(await state(b)).joined); await assert.rejects(command(b, 'media'));
    await b.page.getByRole('button', { name: 'Активности', exact: true }).click(); await b.page.getByRole('button', { name: 'Совместный браузер', exact: true }).click(); await fresh(b);
    record('Guest leave revokes membership and rejoin restores same Session');
    await http(null, `/calls/${callId}/browser-activity`, 'GET', undefined, 401);
    await http(b, `/calls/${callId}/browser-activity/${activityId}/commands`, 'POST', { op: 'close', ownerId: 1 }, 403);
    oldMedia = await command(b, 'media');
    await a.page.getByRole('button', { name: 'Завершить для всех', exact: true }).click();
    await until(async () => !(await state(a))); await until(async () => await b.page.locator('[data-activity-source] video').count() === 0);
    await stableVoice(a); await stableVoice(b);
    const gate = await fetch('http://127.0.0.1:48033/rtc/validate?access_token=' + encodeURIComponent(oldMedia.token)); assert.equal(gate.status, 403);
    record('Unauthorized read, spoofed guest owner/DELETE denied; Close detaches both viewers and revokes cached media JWT; voice survives');
    record('Audio RTP after Activity close', { a: await voiceStats(a), b: await voiceStats(b) });
    await a.page.getByRole('button', { name: 'Активности', exact: true }).click(); await a.page.getByRole('button', { name: 'Совместный браузер', exact: true }).click();
    await fresh(a); const next = await state(a); assert.notEqual(next.activityId, activityId); assert.notEqual(next.session.media.epoch, oldMedia.epoch);
    await http(b, `/calls/${callId}/browser-activity/${activityId}/commands`, 'POST', { op: 'join' }, 409);
    activityId = next.activityId;
    const nextMedia = await command(a, 'media');
    await http(a, '/calls/end', 'POST', { callId, chatRoomId: dm.id });
    await until(async () => { const r = await fetch('http://127.0.0.1:48033/rtc/validate?access_token=' + encodeURIComponent(nextMedia.token)); return r.status === 403; });
    record('Fresh Activity rotates epoch and rejects old rights; separate call end executed');
    assert.deepEqual(errors, []);
    fs.writeFileSync(`${out}/results.json`, JSON.stringify({ status: 'PASS', rows, errors, videoAcceptance: process.argv.includes('--functional') ? 'FUNCTIONAL_ONLY' : mediaProfile.name, syntheticMicrophones: true, hardwareAudibility: 'NOT RUN' }, null, 2));
  } catch (e) {
    rows.push({ name: 'campaign', status: 'FAIL', error: e.message });
    try {
      const diagnostics = await Promise.all(users.map(async user => ({
        user: user.name,
        page: await user.page.evaluate(async () => {
          const call = window.activityStore?.getState?.().call || {};
          const pcs = await Promise.all((window.activityPCs || []).map(async pc => ({
            connectionState: pc.connectionState,
            iceConnectionState: pc.iceConnectionState,
            signalingState: pc.signalingState,
            stats: [...(await pc.getStats()).values()].filter(s => s.type === 'candidate-pair' || s.type === 'inbound-rtp' || s.type === 'outbound-rtp').map(s => ({ type: s.type, kind: s.kind, state: s.state, nominated: s.nominated, selected: s.selected, bytesReceived: s.bytesReceived, bytesSent: s.bytesSent, packetsReceived: s.packetsReceived, packetsSent: s.packetsSent, framesReceived: s.framesReceived, framesDecoded: s.framesDecoded }))
          })));
          return { url: location.href, title: document.title, call: { callId: call.callId, mediaState: call.mediaState, presentationInitialized: call.presentationInitialized, presentationMode: call.presentationMode, livekitRoomName: call.livekitRoomName }, peers: pcs, pageText: document.body.innerText.slice(0, 1000) };
        }),
        pageErrors: user.pageErrors,
        failedRequests: user.failedRequests
      })));
      callId ||= diagnostics.find(d => d.page.call.callId)?.page.call.callId;
      fs.writeFileSync(`${out}/failure-diagnostics.json`, JSON.stringify(diagnostics, null, 2));
    } catch (diagnosticError) {
      fs.writeFileSync(`${out}/failure-diagnostics.json`, JSON.stringify({ error: String(diagnosticError) }, null, 2));
    }
    try { await capture('failure'); } catch {}
    fs.writeFileSync(`${out}/results.json`, JSON.stringify({ status: 'FAIL', rows, errors, error: e.stack }, null, 2));
    console.error(e.stack); process.exitCode = 1;
  } finally {
    fs.writeFileSync(`${out}/network-failures.json`,JSON.stringify(networkFailures,null,2));
    if(fs.existsSync(`${out}/soak.json`) && !fs.existsSync(`${out}/media-acceptance.json`)) fs.writeFileSync(`${out}/media-acceptance.json`,JSON.stringify(evaluateMediaAcceptance(JSON.parse(fs.readFileSync(`${out}/soak.json`)),{requiredDurationMs:process.argv.includes('--soak')?600000:35000,profile:mediaProfile.name}),null,2));
    for(const service of ['api','worker','worker-2','broker','broker-2','publisher','publisher-2','livekit','rtc-relay']) try { fs.writeFileSync(`${out}/${service}.log`,docker('logs','--since','20m',`zvonok-browser-session-${service}-1`)); } catch {}
    if (callId && users[0]) try { await http(users[0], '/calls/end', 'POST', { callId }); } catch {}
    await browser?.close(); await desktop?.close(); console.log('Evidence:', out);
  }
})();

