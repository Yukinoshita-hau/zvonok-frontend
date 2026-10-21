const { chromium } = require(process.env.STAGE10_PLAYWRIGHT || 'C:/Users/Пользователь/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { evaluateMediaAcceptance } = require('./media-acceptance.cjs');
const base = 'http://127.0.0.1:3018', api = 'http://127.0.0.1:18080/api';
const out = `artifacts/stages/work/browser-activity-20261021/${process.argv.includes('--audio')?'slice5-audio':'e2e'}-${Date.now()}`; fs.mkdirSync(out, { recursive: true });
const rows = [], errors = [], users = [], networkFailures=[]; let browser, callId, activityId;
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
async function state(u) { return http(u, `/calls/${callId}/browser-activity`); }
async function command(u, op, body = {}, lease) { const a = lease || await state(u); const c = a?.session?.collaboration; return http(u, `/calls/${callId}/browser-activity/${activityId}/commands`, 'POST', { op, body, epoch: c?.epoch, generation: c ? String(c.generation) : undefined }); }
async function voiceStats(u) { return u.page.evaluate(async () => {
  const result = [];
  for (const pc of window.voicePCsBefore || window.activityPCs) if (pc.connectionState === 'connected') { const stats = await pc.getStats(); stats.forEach(s => { if (s.type === 'inbound-rtp' && s.kind === 'audio') result.push({ packets: s.packetsReceived, bytes: s.bytesReceived }); }); }
  return result;
}); }
async function login(name) {
  const password = crypto.randomBytes(18).toString('hex');
  await http(null, '/auth/register', 'POST', { username: name, email: `${name}@example.com`, password });
  const context = await browser.newContext({ permissions: ['microphone', 'camera'], viewport: { width: 1440, height: 960 } });
  await context.addInitScript(() => {
    window.activityPCs = []; window.activitySockets = []; window.activityBrowserSockets = []; window.activityFrames = [];
    const PC = window.RTCPeerConnection; window.RTCPeerConnection = new Proxy(PC, { construct(Target, args) { const pc = new Target(...args); window.activityPCs.push(pc); return pc; } });
    const WS = window.WebSocket; window.WebSocket = new Proxy(WS, { construct(Target, args) { const ws = new Target(...args); if (String(args[0]).includes(':48033')) window.activityBrowserSockets.push(ws); if (String(args[0]).includes('/ws-raw')) { window.activitySockets.push(ws); ws.addEventListener('message', e => window.activityFrames.push(String(e.data))); } return ws; } });
  });
  const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400){const u=new URL(r.url());networkFailures.push({at:Date.now(),path:u.pathname,status:r.status()});}});
  page.on('requestfailed',r=>{const u=new URL(r.url());networkFailures.push({at:Date.now(),path:u.pathname,error:r.failure()?.errorText});});
  await page.goto(base + '/auth/login'); await page.locator('[name=usernameOrEmail]').fill(name); await page.locator('[name=password]').fill(password); await page.getByRole('button', { name: 'Вход', exact: true }).click();
  await page.waitForFunction(() => window.activityFrames.some(s => s.startsWith('CONNECTED')));
  const token = await page.evaluate(() => {
    const root = document.getElementById('root'), fiber = root[Object.keys(root).find(k => k.startsWith('__reactContainer$'))];
    const stack = [fiber.stateNode?.current || fiber];
    while (stack.length) { const f = stack.pop(); if (f.memoizedProps?.store?.getState) { window.activityStore = f.memoizedProps.store; return window.activityStore.getState().user.accessToken; } if (f.child) stack.push(f.child); if (f.sibling) stack.push(f.sibling); }
    throw Error('No store');
  });
  const u = { name, context, page, token }; users.push(u); return u;
}
async function fresh(u) { await u.page.waitForFunction(() => window.browserActivityMetrics?.fresh && window.browserActivityMetrics?.framesDecoded > 5, null, { timeout: 30000 }); }
async function capture(name) { for (let i = 0; i < users.length; i++) await users[i].page.screenshot({ path: `${out}/${name}-${i ? 'B' : 'A'}.png` }); }
async function rememberVoice(u) { await u.page.evaluate(async () => {
  window.voicePCsBefore = [];
  for (const pc of window.activityPCs) if (pc.connectionState === 'connected') {
    const stats = await pc.getStats(); let audio = false;
    stats.forEach(s => { if ((s.type === 'inbound-rtp' || s.type === 'outbound-rtp') && s.kind === 'audio') audio = true; });
    if (audio) window.voicePCsBefore.push(pc);
  }
  if (!window.voicePCsBefore.length) throw Error('No actual voice RTP connection');
  window.voiceCallBefore = window.activityStore.getState().call.livekitRoomName;
}); }
async function stableVoice(u) { assert(await u.page.evaluate(() => window.voicePCsBefore.every(p => p.connectionState === 'connected') && window.voiceCallBefore === window.activityStore.getState().call.livekitRoomName)); }
async function bindStore(page) {
  await page.waitForFunction(() => window.activityFrames.some(s => s.startsWith('CONNECTED')));
  await page.evaluate(() => {
    const root = document.getElementById('root'), fiber = root[Object.keys(root).find(k => k.startsWith('__reactContainer$'))];
    const stack = [fiber.stateNode?.current || fiber];
    while (stack.length) { const f = stack.pop(); if (f.memoizedProps?.store?.getState) { window.activityStore = f.memoizedProps.store; return; } if (f.child) stack.push(f.child); if (f.sibling) stack.push(f.sibling); }
    throw Error('No store');
  });
}
function docker(...args) { return execFileSync('docker', ['--context', 'desktop-linux', ...args], { encoding: 'utf8', timeout: 30000, stdio: ['pipe', 'pipe', 'pipe'] }); }
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
  await until(async () => !(await state(a)));
  const oldGate = await fetch('http://127.0.0.1:48033/rtc/validate?access_token=' + encodeURIComponent(crashMedia.token)); assert.equal(oldGate.status, 403);
  await stableVoice(a); await stableVoice(b);
  record('Real capture crash closes Activity and cached viewer rights; voice survives');
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
  await b.page.getByRole('button', { name: 'Присоединиться', exact: true }).click(); await fresh(a); await fresh(b);
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

async function audioCampaign(a,b,dm) {
  const original=(await state(a)).session;
  await a.page.getByRole('textbox',{name:'Адрес страницы'}).fill('https://example.com/capture-fixture');
  await a.page.getByRole('button',{name:'Перейти',exact:true}).click();
  await until(async()=>(await state(a)).session.currentUrl.includes('capture-fixture'));await fresh(a);await fresh(b);
  async function clickFixture(u) {const r=await u.page.locator('[data-activity-source] video').boundingBox(),scale=Math.min(r.width/1280,r.height/720);await u.page.mouse.click(r.x+(r.width-1280*scale)/2+1100*scale,r.y+(r.height-720*scale)/2+240*scale);}
  async function audio(u){return u.page.evaluate(()=>window.browserAudioMetrics);}
  async function enable(u){await u.page.getByRole('button',{name:'Включить звук сайта',exact:true}).click();await until(async()=>{const m=await audio(u);return m && !m.paused;});}
  async function signal(u){await until(async()=>{const m=await audio(u);return m?.totalAudioEnergy>0.001 && m.totalSamplesReceived>4800;});}
  async function probe(u) {
    await u.page.evaluate(async()=>{
      const audio=document.querySelector('.browser-audio-controls audio');
      const context=new AudioContext();await context.resume();
      const analyser=context.createAnalyser();analyser.fftSize=512;
      const source=context.createMediaStreamSource(audio.srcObject);source.connect(analyser);
      const pcm=new Float32Array(512),canvas=document.createElement('canvas');canvas.width=1;canvas.height=1;const pixels=canvas.getContext('2d',{willReadFrequently:true});
      window.avProbe={audio:[],video:[],rms:[],context};let lastAudio=false,lastVideo=false;
      window.avProbe.timer=setInterval(()=>{
        analyser.getFloatTimeDomainData(pcm);const rms=Math.sqrt(pcm.reduce((sum,v)=>sum+v*v,0)/pcm.length),now=performance.now();
        const v=document.querySelector('[data-activity-source] video');if(!v?.videoWidth)return;
        pixels.drawImage(v,1220,20,1,1,0,0,1,1);const pixel=pixels.getImageData(0,0,1,1).data;
        const tone=rms>0.04,flash=pixel[0]>180 && pixel[1]>180 && pixel[2]>180;
        if(tone && !lastAudio)window.avProbe.audio.push(now);if(flash && !lastVideo)window.avProbe.video.push(now);
        lastAudio=tone;lastVideo=flash;
        window.avProbe.rms.push({at:now,rms});if(window.avProbe.rms.length>4000)window.avProbe.rms.shift();
      },10);
    });
  }
  async function stopProbe(u){return u.page.evaluate(async()=>{const p=window.avProbe;clearInterval(p.timer);await p.context.close();return {audio:p.audio,video:p.video,rms:p.rms};});}
  await enable(a);await enable(b);await clickFixture(a);await signal(a);await signal(b);
  await probe(a);await probe(b);await capture('audio-focus');
  record('A/B real browser PCM decoded, nonzero energy and explicit playback', {a:await audio(a),b:await audio(b)});
  await a.page.getByRole('button',{name:'Выключить звук сайта',exact:true}).click();
  assert((await a.page.locator('.browser-audio-controls audio').evaluate(e=>e.paused)));
  assert(!(await b.page.locator('.browser-audio-controls audio').evaluate(e=>e.paused)));
  await enable(a);
  for(const [u,volume]of [[a,'30'],[b,'80']]) {
    await u.page.locator('.browser-audio-controls summary').click();
    await u.page.getByRole('slider',{name:'Громкость сайта'}).fill(volume);
  }
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
  const duration=process.argv.includes('--soak')?600000:35000,samples=[],gaps=[];
  fs.writeFileSync(`${out}/resources-before.jsonl`,docker('stats','--no-stream','--format','{{json .}}','zvonok-browser-session-worker-1','zvonok-browser-session-publisher-1','zvonok-browser-session-livekit-1'));
  const start=Date.now();
  samples.push({elapsedMs:0,a:await audio(a),b:await audio(b),videoA:await a.page.evaluate(()=>window.browserActivityMetrics),videoB:await b.page.evaluate(()=>window.browserActivityMetrics)});
  while(Date.now()-start<duration) {
    await sleep(2000);const sample={elapsedMs:Date.now()-start,a:await audio(a),b:await audio(b),videoA:await a.page.evaluate(()=>window.browserActivityMetrics),videoB:await b.page.evaluate(()=>window.browserActivityMetrics)};samples.push(sample);
    fs.writeFileSync(`${out}/soak.json`,JSON.stringify(samples,null,2));
    if(!sample.a || !sample.b || !sample.videoA?.fresh || !sample.videoB?.fresh) {
      const gap={at:Date.now(),elapsedMs:sample.elapsedMs,a:!!sample.a,b:!!sample.b,videoA:!!sample.videoA?.fresh,videoB:!!sample.videoB?.fresh};gaps.push(gap);fs.writeFileSync(`${out}/gaps.json`,JSON.stringify(gaps,null,2));
      await capture(`gap-${Math.round(sample.elapsedMs)}`);
      fs.writeFileSync(`${out}/gap-state.json`,JSON.stringify({at:Date.now(),a:await state(a),b:await state(b),textA:await a.page.locator('[data-activity-source]').textContent().catch(()=>null),textB:await b.page.locator('[data-activity-source]').textContent().catch(()=>null)},null,2));
      await fresh(a);await fresh(b);await until(async()=>!!(await audio(a)) && !!(await audio(b)),20000);gap.recoveryMs=Date.now()-gap.at;
      continue;
    }
    assert(sample.a.totalAudioEnergy>0 && sample.b.totalAudioEnergy>0);
    if(samples.length>1)for(const key of ['a','b']){const previous=samples.at(-2)[key];if(previous && previous.trackSid===sample[key].trackSid)assert(sample[key].totalSamplesReceived>previous.totalSamplesReceived,'Browser decoded samples must progress');}
    if(samples.length%15===0)console.table([{elapsedSec:Math.round(sample.elapsedMs/1000),aSamples:sample.a.totalSamplesReceived,bSamples:sample.b.totalSamplesReceived}]);
  }
  const av={a:await stopProbe(a),b:await stopProbe(b)};
  fs.writeFileSync(`${out}/resources-after.jsonl`,docker('stats','--no-stream','--format','{{json .}}','zvonok-browser-session-worker-1','zvonok-browser-session-publisher-1','zvonok-browser-session-livekit-1'));
  for(const p of Object.values(av)){p.offsets=p.video.map(t=>{const closest=p.audio.reduce((a,b)=>Math.abs(b-t)<Math.abs(a-t)?b:a,Infinity);return t-closest;}).filter(x=>Math.abs(x)<600);const sorted=p.offsets.map(Math.abs).sort((a,b)=>a-b);p.p95AbsoluteMs=sorted[Math.floor(sorted.length*0.95)];}
  fs.writeFileSync(`${out}/av.json`,JSON.stringify(av,null,2));
  const mediaAcceptance=evaluateMediaAcceptance(samples,{requiredDurationMs:duration});
  fs.writeFileSync(`${out}/media-acceptance.json`,JSON.stringify(mediaAcceptance,null,2));
  record('Continuous actual two-client browser A/V campaign',{durationMs:Date.now()-start,gaps,avA:av.a.p95AbsoluteMs,avB:av.b.p95AbsoluteMs,criterion:'p95<=150ms; receiver analyser/render observation, not physical output'});
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
  fs.writeFileSync(`${out}/results.json`,JSON.stringify({status:'PASS',rows,errors,mediaAcceptance,syntheticMicrophones:true,physicalListening:'NOT RUN',avCriterion:av.a.p95AbsoluteMs<=150 && av.b.p95AbsoluteMs<=150?'OBSERVED_PASS_NOT_PHYSICAL':'FAIL_OR_UNVERIFIED'},null,2));
}

(async () => {
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', ...(process.argv.includes('--audio')?[]:['--autoplay-policy=no-user-gesture-required'])] });
    const suffix = Date.now().toString().slice(-9), a = await login('activity_a' + suffix), b = await login('activity_b' + suffix);
    record('Two real Core registrations and UI logins; independent JWTs');
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
    await b.page.getByRole('button', { name: 'Присоединиться', exact: true }).click({ timeout: 30000 });
    await fresh(a); await fresh(b); activityId = (await state(a)).activityId;
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
        await b.page.getByRole('button', { name: 'Присоединиться', exact: true }).click({ timeout: 30000 });
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
      assert(samples[i][key].framesDecoded > (i ? samples[i - 1][key].framesDecoded : key === 'a' ? before.framesDecoded : beforeB.framesDecoded));
    }
    const fpsA = (afterA.framesDecoded - before.framesDecoded) * 1000 / (afterA.at - before.at);
    const fpsB = (afterB.framesDecoded - beforeB.framesDecoded) * 1000 / (afterB.at - beforeB.at);
    assert(fpsA >= 14.5 && fpsB >= 14.5, `Decoded FPS below 14.5: A=${fpsA} B=${fpsB}`);
    assert.equal(afterA.width, 1280); assert.equal(afterB.width, 1280);
    record('Continuous 720p15 decoded video', { a: afterA, b: afterB, framesDelta: afterA.framesDecoded - before.framesDecoded, seconds: (afterA.at - before.at) / 1000 });
    fs.writeFileSync(`${out}/resources.jsonl`, docker('stats', '--no-stream', '--format', '{{json .}}', 'zvonok-browser-session-worker-1', 'zvonok-browser-session-publisher-1', 'zvonok-browser-session-livekit-1'));
    await b.page.getByRole('button', { name: 'Запросить управление', exact: true }).click();
    await a.page.getByRole('button', { name: 'Передать', exact: true }).click();
    await until(async () => { const s = (await state(b)).session.collaboration; return s.controller === s.identity; });
    const stale = await state(b);
    await b.page.getByRole('button', { name: 'Вернуть управление хозяину', exact: true }).waitFor();
    const bounds = await b.page.locator('[data-activity-source] video').boundingBox(), scale = Math.min(bounds.width / 1280, bounds.height / 720);
    await b.page.mouse.click(bounds.x + (bounds.width - 1280 * scale) / 2 + 160 * scale, bounds.y + (bounds.height - 720 * scale) / 2 + 134 * scale);
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
    fs.writeFileSync(`${out}/results.json`, JSON.stringify({ status: 'PASS', rows, errors, syntheticMicrophones: true, hardwareAudibility: 'NOT RUN' }, null, 2));
  } catch (e) {
    rows.push({ name: 'campaign', status: 'FAIL', error: e.message });
    try { await capture('failure'); } catch {}
    fs.writeFileSync(`${out}/results.json`, JSON.stringify({ status: 'FAIL', rows, errors, error: e.stack }, null, 2));
    console.error(e.stack); process.exitCode = 1;
  } finally {
    fs.writeFileSync(`${out}/network-failures.json`,JSON.stringify(networkFailures,null,2));
    if(fs.existsSync(`${out}/soak.json`) && !fs.existsSync(`${out}/media-acceptance.json`)) fs.writeFileSync(`${out}/media-acceptance.json`,JSON.stringify(evaluateMediaAcceptance(JSON.parse(fs.readFileSync(`${out}/soak.json`)),{requiredDurationMs:process.argv.includes('--soak')?600000:35000}),null,2));
    for(const service of ['worker','publisher','broker']) try { fs.writeFileSync(`${out}/${service}.log`,docker('logs','--since','20m',`zvonok-browser-session-${service}-1`)); } catch {}
    if (callId && users[0]) try { await http(users[0], '/calls/end', 'POST', { callId }); } catch {}
    await browser?.close(); console.log('Evidence:', out);
  }
})();

