const { chromium, _electron } = require(process.env.STAGE10_PLAYWRIGHT || 'C:/Users/Пользователь/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const out = path.resolve('artifacts/stages/local-docker/acceptance'); fs.mkdirSync(out, { recursive: true });
const base = 'http://localhost:3000', api = 'http://localhost:8080/api';
const executablePath = path.resolve('artifacts/stages/local-docker/package/win-unpacked/Zvonok.exe');
const rows = [], requests = new Set(), sockets = new Set();
const args = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'];
let browser, desktop, accounts;
const save = () => fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ rows, observedHttp: [...requests], observedWebSockets: [...sockets], audioSource: 'Синтетический звук Chromium; настоящий LiveKit/RTP', dockerServicesModified: false }, null, 2));
const pass = (name, details = {}) => { rows.push({ name, status: 'PASS', ...details }); save(); console.log('PASS: ' + name); };
async function instrument(context) {
  context.on('request', request => { const url = new URL(request.url()); if (/^https?:$/.test(url.protocol)) requests.add(url.origin + url.pathname); });
  const record = page => page.on('websocket', socket => { const url = new URL(socket.url()); sockets.add(url.origin + url.pathname); });
  context.on('page', record); context.pages().forEach(record);
  await context.addInitScript(() => {
    window.qaPCs = []; window.qaCsp = [];
    const PC = RTCPeerConnection;
    window.RTCPeerConnection = new Proxy(PC, { construct(Target, args) { const pc = new Target(...args); window.qaPCs.push(pc); return pc; } });
    document.addEventListener('securitypolicyviolation', event => window.qaCsp.push({ directive: event.effectiveDirective, blocked: event.blockedURI.split('?')[0] }));
  });
}
async function bind(page) {
  await page.waitForFunction(() => {
    const root = document.getElementById('root'); if (!root) return false;
    const fiber = root[Object.keys(root).find(key => key.startsWith('__reactContainer$'))]; if (!fiber) return false;
    const stack = [fiber.stateNode?.current || fiber];
    while (stack.length) { const f = stack.pop(); if (f.memoizedProps?.store?.getState) { window.qaStore = f.memoizedProps.store; return true; } if (f.child) stack.push(f.child); if (f.sibling) stack.push(f.sibling); }
    return false;
  });
}
async function ready(page) { await page.locator('[aria-label="Панель пользователя"]').waitFor(); await bind(page); await page.waitForFunction(() => window.qaStore.getState().websocket.isConnected); }
async function login(page, user) {
  await page.goto(base + '/auth/login');
  await page.locator('[name=usernameOrEmail]').fill(user.username); await page.locator('[name=password]').fill(user.password);
  await page.getByRole('button', { name: 'Вход', exact: true }).click(); await ready(page);
}
async function http(page, route, method = 'GET', body) {
  return page.evaluate(async ({ api, route, method, body }) => {
    const user = window.qaStore.getState().user;
    const response = await fetch(api + route, { method, credentials: 'include', headers: { Authorization: `${user.tokenType} ${user.accessToken}`, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    if (!response.ok) throw Error(`${route}: HTTP ${response.status}`);
    return response.json();
  }, { api, route, method, body });
}
async function connected(page) { await page.waitForFunction(() => window.qaStore.getState().call.mediaState === 'connected' && window.qaStore.getState().call.presentationInitialized && window.qaPCs.some(pc => pc.connectionState === 'connected'), null, { timeout: 45000 }); }
async function stats(page) { return page.evaluate(async () => {
  let inbound = 0, outbound = 0, connections = 0;
  for (const pc of window.qaPCs) if (pc.connectionState === 'connected') { connections++; (await pc.getStats()).forEach(s => { if (s.kind === 'audio') { if (s.type === 'inbound-rtp') inbound += s.bytesReceived || 0; if (s.type === 'outbound-rtp') outbound += s.bytesSent || 0; } }); }
  return { inbound, outbound, connections };
}); }
async function unmute(page) {
  const control = page.locator('[data-call-stage]:not([hidden]), [data-call-dock]:not([hidden])').getByRole('button', { name: /^Микрофон: выключен/ });
  if (await control.count()) await control.first().click();
}
async function launch() {
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  desktop = await _electron.launch({ executablePath, args, env, timeout: 30000 });
  await instrument(desktop.context());
  if (!desktop.windows().some(page => page.url().startsWith(base))) await desktop.waitForEvent('window', { predicate: page => page.url().startsWith(base), timeout: 30000 }).catch(() => {});
  const page = desktop.windows().find(page => page.url().startsWith(base)); assert(page, 'Local packaged main window missing'); page.setDefaultTimeout(25000);
  return page;
}
(async () => {
  try {
    const credentialFile = path.join(out, 'accounts.local');
    accounts = fs.existsSync(credentialFile) ? JSON.parse(fs.readFileSync(credentialFile, 'utf8')) : [0, 1].map(i => ({ username: `localqa${Date.now()}${i}`, password: crypto.randomBytes(18).toString('hex'), registered: false }));
    fs.writeFileSync(credentialFile, JSON.stringify(accounts));
    browser = await chromium.launch({ headless: true, args });
    const contexts = await Promise.all([0, 1].map(() => browser.newContext({ permissions: ['microphone', 'camera'] })));
    for (const context of contexts) await instrument(context);
    const pages = await Promise.all(contexts.map(context => context.newPage()));
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i], user = accounts[i]; page.setDefaultTimeout(25000);
      if (user.registered) await login(page, user);
      else {
        await page.goto(base + '/auth/register');
        await page.locator('[name=username]').fill(user.username); await page.locator('[name=email]').fill(user.username + '@example.invalid'); await page.locator('[name=password]').fill(user.password);
        await page.getByRole('button', { name: 'Создать', exact: true }).click(); await ready(page);
        user.registered = true; fs.writeFileSync(credentialFile, JSON.stringify(accounts));
      }
    }
    const [web, peer] = pages;
    for (const page of pages) {
      const end = page.getByRole('button', { name: 'Завершить', exact: true });
      if (await end.count()) { await end.first().click(); await page.waitForFunction(() => window.qaStore.getState().call.callId === null); }
    }
    pass('Обычный веб: регистрация и вход двух QA-аккаунтов через backend 8080', { usernames: accounts.map(user => user.username) });
    let friends = await http(web, '/friends');
    if (!friends.some(friend => friend.friendUsername === accounts[1].username)) {
      await web.evaluate(username => window.qaStore.dispatch({ type: 'friend/sendFriendRequest', payload: { username } }), accounts[1].username);
      await peer.waitForFunction(username => window.qaStore.getState().friend.incomingRequests.some(request => request.senderUsername === username), accounts[0].username);
      const pending = (await http(peer, '/friends/requests/incoming')).find(request => request.senderUsername === accounts[0].username);
      await peer.evaluate(requestId => window.qaStore.dispatch({ type: 'friend/acceptFriendRequest', payload: { requestId } }), pending.requestId);
      await web.waitForFunction(username => window.qaStore.getState().friend.friends.some(friend => friend.friendUsername === username), accounts[1].username);
    }
    const rooms = await http(web, '/rooms/all'), room = rooms.find(room => room.type === 'PRIVATE' && room.members.some(member => member.username === accounts[1].username));
    assert(room, 'Test DM room missing');
    await web.goto(`${base}/dm?roomId=${room.id}`); await ready(web);
    const message = 'LOCAL_DOCKER QA history ' + Date.now();
    await web.getByRole('textbox', { name: 'Сообщение', exact: true }).fill(message);
    await web.getByRole('button', { name: 'Отправить сообщение', exact: true }).click();
    await web.getByText(message, { exact: true }).first().waitFor();
    let page = await launch();
    await page.reload(); await login(page, accounts[0]);
    assert.equal((await http(page, '/users/my')).username, accounts[0].username);
    pass('Упакованный Electron входит в аккаунт, созданный обычным вебом');
    const profile = await desktop.evaluate(({ app }) => app.getPath('userData'));
    assert.equal(path.basename(profile), 'Zvonok-LOCAL_DOCKER');
    const cookies = (await desktop.context().cookies()).filter(cookie => cookie.name === 'refreshToken').map(({ httpOnly, secure, sameSite, domain, path, expires }) => ({ httpOnly, secure, sameSite, domain, path, persistent: expires > 0 }));
    assert(cookies.length && cookies.every(cookie => cookie.httpOnly));
    pass('Отдельный userData и настоящий HttpOnly refresh-cookie', { profile, cookies });
    assert.deepEqual(await http(page, '/friends'), await http(web, '/friends'));
    pass('Список друзей совпадает между вебом и Electron');
    await page.goto(`${base}/dm?roomId=${room.id}`); await ready(page);
    await page.getByText(message, { exact: true }).first().waitFor();
    pass('Ранее отправленное веб-сообщение загружается из истории в Electron');
    const reply = 'LOCAL_DOCKER QA reply ' + Date.now();
    await page.getByRole('textbox', { name: 'Сообщение', exact: true }).fill(reply); await page.getByRole('button', { name: 'Отправить сообщение', exact: true }).click();
    await web.getByText(reply, { exact: true }).first().waitFor();
    pass('DM из Electron доставляется в обычный веб');
    await peer.goto(`${base}/dm?roomId=${room.id}`); await ready(peer);
    await page.getByRole('button', { name: 'Начать звонок', exact: true }).click();
    await peer.getByRole('button', { name: 'Принять', exact: true }).waitFor(); await peer.getByRole('button', { name: 'Принять', exact: true }).click();
    await Promise.all([connected(page), connected(peer)]);
    const server = await page.evaluate(() => window.qaStore.getState().call.serverUrl); assert.equal(server, 'ws://127.0.0.1:7880');
    pass('Реальный звонок между двумя пользователями принят; LiveKit подключён', { server });
    for (const p of [page, peer]) await unmute(p);
    const before = await Promise.all([stats(page), stats(peer)]); await page.waitForTimeout(4000); const after = await Promise.all([stats(page), stats(peer)]);
    after.forEach((s, i) => assert(s.inbound > before[i].inbound && s.outbound > before[i].outbound, 'RTP must grow in both directions'));
    pass('RTP audio растёт в обе стороны', { before, after, source: 'Синтетический тестовый звук Chromium, настоящий RTP' });
    const windowId = await desktop.evaluate(({ BrowserWindow }, url) => BrowserWindow.getAllWindows().find(w => w.webContents.getURL() === url).id, page.url());
    await desktop.evaluate(({ BrowserWindow }, id) => BrowserWindow.fromId(id).hide(), windowId); await page.waitForTimeout(1500);
    await desktop.evaluate(({ BrowserWindow }, id) => { BrowserWindow.fromId(id).show(); BrowserWindow.fromId(id).focus(); }, windowId);
    await connected(page); const restored = await stats(peer); assert(restored.inbound > after[1].inbound);
    pass('Скрытие и восстановление окна сохраняет звонок и растущий RTP');
    await page.reload(); await ready(page); await connected(page);
    await unmute(page);
    assert.equal(await page.evaluate(() => window.qaPCs.filter(pc => pc.connectionState === 'connected').length), before[0].connections);
    assert.equal(await page.evaluate(() => window.qaStore.getState().call.mediaOwnership), 'OWNED');
    const reloadedBefore = await stats(peer); await peer.waitForTimeout(2000); const reloadedAfter = await stats(peer); assert(reloadedAfter.inbound > reloadedBefore.inbound);
    pass('Reload активного звонка восстанавливает одного владельца и растущий RTP');
    await page.getByRole('button', { name: 'Завершить', exact: true }).first().click();
    await page.waitForFunction(() => window.qaStore.getState().call.callId === null);
    await desktop.evaluate(({ session }) => session.defaultSession.webRequest.onBeforeRequest({ urls: ['ws://127.0.0.1:7880/*'] }, (_details, callback) => setTimeout(() => callback({}), 2000)));
    await page.getByRole('button', { name: 'Начать звонок', exact: true }).click();
    await peer.getByRole('button', { name: 'Принять', exact: true }).click();
    await page.waitForFunction(() => window.qaStore.getState().call.participantToken && !window.qaPCs.some(pc => pc.connectionState === 'connected'));
    await page.reload(); await ready(page); await Promise.all([connected(page), connected(peer)]);
    await desktop.evaluate(({ session }) => session.defaultSession.webRequest.onBeforeRequest(null));
    await page.waitForTimeout(6000);
    assert.equal(await page.evaluate(() => window.qaStore.getState().call.mediaOwnership), 'OWNED');
    assert.equal(await page.evaluate(() => window.qaPCs.filter(pc => pc.connectionState === 'connected').length), before[0].connections);
    pass('Reload во время задержанного SFU-подключения не теряет владельца');
    await page.getByRole('button', { name: 'Завершить', exact: true }).first().click();
    await page.waitForFunction(() => window.qaStore.getState().call.callId === null);
    await desktop.close(); desktop = null;
    page = await launch(); await page.reload(); await ready(page);
    assert.equal((await http(page, '/users/my')).username, accounts[0].username);
    pass('Перезапуск exe восстанавливает авторизацию через настоящий refresh-cookie');
    await page.screenshot({ path: path.join(out, 'local-docker.png') });
    const csp = await page.evaluate(() => window.qaCsp); assert(!csp.some(event => event.directive === 'connect-src'), 'Unexpected CSP connection block');
    assert([...sockets].some(url => url === 'ws://localhost:8080/api/ws-raw'));
    assert([...sockets].some(url => url.startsWith('ws://127.0.0.1:7880/')));
    assert(![...requests, ...sockets].some(url => /:(18086|48886)\b/.test(url)));
    pass('Наблюдаемые API/STOMP/SFU адреса принадлежат обычному Docker; E6 отсутствует');
    const logout = await http(page, '/auth/logout', 'POST', { allDevices: false }); assert.equal(logout.allDevices, false);
    await page.goto(base + '/auth/login'); await bind(page); await page.waitForFunction(() => !window.qaStore.getState().user.accessToken);
    assert(!(await desktop.context().cookies()).some(cookie => cookie.name === 'refreshToken'));
    pass('Только QA-сеанс Electron завершён: следующий запуск предлагает вход пользователю');
  } catch (error) {
    if (desktop) for (const [index, page] of desktop.windows().entries()) await page.screenshot({ path: path.join(out, `failure-${index}.png`) }).catch(() => {});
    let message = String(error.message).replace(/eyJ[A-Za-z0-9_.-]+/g, '[REDACTED]');
    for (const account of accounts || []) message = message.replaceAll(account.password, '[REDACTED]');
    rows.push({ name: 'Приёмка прервана', status: 'FAIL', error: message.slice(0, 1500) }); console.error('FAIL: ' + rows.at(-1).error); process.exitCode = 1;
  } finally {
    save();
    if (desktop) {
      const page = desktop.windows().find(page => page.url().startsWith(base));
      if (page) await page.getByRole('button', { name: 'Завершить', exact: true }).first().click({ timeout: 1500 }).catch(() => {});
      await desktop.close().catch(() => {});
    }
    if (browser) await browser.close();
  }
})();
