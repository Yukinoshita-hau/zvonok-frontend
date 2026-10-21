// Actual application entry point; never substitute a synthetic BrowserWindow.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { _electron } = require('C:/Users/Пользователь/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out = path.resolve(process.env.ZVONOK_PROBE_OUT || 'artifacts/stages/work/electron-native/before');
fs.mkdirSync(out, { recursive: true });
process.on('unhandledRejection', error => {
  fs.writeFileSync(path.join(out, 'launch-error.json'), JSON.stringify({ status: 'NOT RUN', error: String(error) }, null, 2));
  console.error(String(error));
});
(async () => {
  const env = { ...process.env, VITE_DEV_SERVER_URL: 'http://127.0.0.1:3038', ZVONOK_DESKTOP_PROFILE: path.join(out, 'profile') };
  delete env.ELECTRON_RUN_AS_NODE;
  let desktop;
  const diagnostics = { failedRequests: [], consoleErrors: [] };
  try {
    const start = Date.now();
    const packaged = process.env.ZVONOK_PACKAGED_EXE;
    const entry = process.env.ZVONOK_PROBE_ENTRY || '.';
    desktop = await _electron.launch({ executablePath: path.resolve(packaged || 'node_modules/electron/dist/electron.exe'), args: [...(packaged ? [] : [entry]), '--user-data-dir=' + path.join(out, 'profile')], env, timeout: 20000 });
    desktop.context().on('requestfailed', request => { const url = new URL(request.url()); diagnostics.failedRequests.push({ url: `${url.origin}${url.pathname}`, error: request.failure()?.errorText }); });
    desktop.context().on('page', window => window.on('console', message => { if (message.type() === 'error') diagnostics.consoleErrors.push(message.text().slice(0, 1000)); }));
    await desktop.context().route('**/auth/refresh', route => route.fulfill({ status: 401, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': packaged ? 'null' : 'http://127.0.0.1:3038', 'Access-Control-Allow-Credentials': 'true' }, body: '{"message":"Isolated unauthenticated native probe"}' }));
    await desktop.firstWindow();
    let page;
    for (let attempt = 0; attempt < 100; attempt++) {
      page = desktop.windows().find(window => window.url().startsWith('http://127.0.0.1:3038/') || (window.url().startsWith('file:') && window.url().includes('index.html')));
      if (page) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert(page, 'Actual application window must load');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForURL(url => url.href.includes('/auth/login'), { timeout: 25000 });
    await page.locator('input[name="usernameOrEmail"]').waitFor();
    const visibleMs = Date.now() - start;
    await page.screenshot({ path: path.join(out, 'main.png') });
    const details = await desktop.evaluate(({ app, BrowserWindow }) => ({
      versions: process.versions, metrics: app.getAppMetrics(),
      windows: BrowserWindow.getAllWindows().map(w => ({ title: w.getTitle(), visible: w.isVisible(), bounds: w.getBounds(), preferences: w.webContents.getLastWebPreferences() })),
    }));
    const bridge = await page.evaluate(() => ({ available: !!window.zvonokDesktop, node: typeof window.require, platform: window.zvonokDesktop?.platform }));
    const checks = [];
    const resourceSamples = [];
    const mainId = await desktop.evaluate(({ BrowserWindow }, url) => BrowserWindow.getAllWindows().find(window => window.webContents.getURL() === url).id, page.url());
    if (process.env.ZVONOK_BASELINE !== '1') assert(bridge.available);
    assert.equal(bridge.node, 'undefined');
    if (packaged) {
      await page.evaluate(() => { const script = document.createElement('script'); script.textContent = 'window.__inlineCspProbe = true'; document.head.append(script); });
      const inlineExecuted = await page.evaluate(() => window.__inlineCspProbe === true);
      checks.push({ productionInlineScriptBlocked: !inlineExecuted });
      assert.equal(inlineExecuted, false, 'Production CSP must reject inline scripts');
    }
    if (process.env.ZVONOK_NATIVE_CONTROLLERS === '1') {
      const dockPromise = desktop.waitForEvent('window');
      await page.evaluate(async () => {
        const state = { callKey: '4242:1', title: 'Тест IPC — без media', connection: 'connected', microphoneEnabled: false, speaking: 'Тест controller, без звонка' };
        window.zvonokDesktop.dock.onCommand(async command => {
          if (command.callKey !== state.callKey || command.action !== 'microphone') return;
          state.microphoneEnabled = command.enabled;
          await window.zvonokDesktop.dock.publish(state);
          await window.zvonokDesktop.dock.ack({ id: command.id, callKey: state.callKey, ok: true });
        });
        await window.zvonokDesktop.dock.publish(state);
        await window.zvonokDesktop.dock.open();
      });
      const dockPage = await dockPromise;
      await dockPage.locator('#microphone').waitFor();
      await dockPage.locator('#microphone').click();
      await dockPage.getByRole('button', { name: 'Выключить микр.', exact: true }).waitFor();
      await new Promise(resolve => setTimeout(resolve, 1000));
      resourceSamples.push({ stage: 'dock-open-test-controller', metrics: await desktop.evaluate(({ app }) => app.getAppMetrics()) });
      checks.push('actual dock IPC command/ack routed to a TEST controller; no media capture');
      await dockPage.locator('#top').check();
      assert(await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(w => w.getTitle() === 'Zvonok — звонок').isAlwaysOnTop()));
      await dockPage.screenshot({ path: path.join(out, 'dock-top-controller-only.png') });
      await dockPage.locator('#top').uncheck();
      assert.equal(await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(w => w.getTitle() === 'Zvonok — звонок').isAlwaysOnTop()), false);
      await dockPage.screenshot({ path: path.join(out, 'dock-normal-controller-only.png') });
      checks.push('alwaysOnTop ON/OFF API state');
      const stale = await dockPage.evaluate(async () => {
        try { await window.zvonokDock.command({ callKey: '1:1', action: 'microphone', enabled: false }); return false; }
        catch { return true; }
      });
      assert(stale); checks.push('stale dock command rejected');
      await desktop.evaluate(({ BrowserWindow }, id) => BrowserWindow.fromId(id).close(), mainId);
      assert.equal(await desktop.evaluate(({ BrowserWindow }, id) => BrowserWindow.fromId(id).isVisible(), mainId), false);
      await new Promise(resolve => setTimeout(resolve, 1000));
      resourceSamples.push({ stage: 'main-hidden-test-controller', metrics: await desktop.evaluate(({ app }) => app.getAppMetrics()) });
      const secondary = spawnSync(path.resolve(packaged || 'node_modules/electron/dist/electron.exe'), [...(packaged ? [] : [entry]), '--user-data-dir=' + path.join(out, 'profile')], { env, timeout: 10000, windowsHide: true });
      assert.equal(secondary.status, 0, 'Second app instance must exit');
      let restored = false;
      for (let attempt = 0; attempt < 20; attempt++) {
        restored = await desktop.evaluate(({ BrowserWindow }, id) => BrowserWindow.fromId(id).isVisible(), mainId);
        if (restored) break;
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      assert(restored); checks.push('second launch exits and restores existing main');
      await dockPage.locator('#main').click();
      assert(await desktop.evaluate(({ BrowserWindow }, id) => BrowserWindow.fromId(id).isVisible(), mainId));
      checks.push('main close hides; dock show-main restores');
      const closed = dockPage.waitForEvent('close');
      await dockPage.locator('#close').click();
      await closed;
      const reopened = desktop.waitForEvent('window');
      await page.evaluate(() => window.zvonokDesktop.dock.open());
      const reopenedPage = await reopened;
      await reopenedPage.locator('#title').waitFor();
      await page.reload();
      await page.locator('input[name="usernameOrEmail"]').waitFor();
      assert.equal(await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().filter(w => w.getTitle() === 'Zvonok — звонок').length), 0);
      checks.push('close/reopen dock and owner reload cleanup');
    }
    fs.writeFileSync(path.join(out, 'runtime.json'), JSON.stringify({ status: 'PASS', scope: packaged ? 'actual win-unpacked staging package; unauthenticated; optional dock uses TEST controller without media' : process.env.ZVONOK_BASELINE === '1' ? 'original main/preload from preserved baseline with current renderer, unauthenticated shell only' : 'actual app dev runtime, unauthenticated; dock IPC uses explicit TEST controller without a media Room', visibleMs, bridge, checks, resourceSamples, diagnostics, ...details }, null, 2));
    console.log({ status: 'PASS', visibleMs, bridge });
  } catch (error) {
    if (desktop) {
      const windows = desktop.windows();
      fs.writeFileSync(path.join(out, 'failure-windows.json'), JSON.stringify(windows.map(page => ({ url: page.url() })), null, 2));
      if (windows[0]) await windows[0].screenshot({ path: path.join(out, 'failure.png') }).catch(() => {});
    }
    fs.writeFileSync(path.join(out, 'runtime.json'), JSON.stringify({ status: 'FAIL', error: String(error), diagnostics }, null, 2));
    console.error(String(error)); process.exitCode = 1;
  } finally { if (desktop) await desktop.close(); }
})();
