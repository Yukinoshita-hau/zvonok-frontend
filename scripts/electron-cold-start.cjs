const fs = require('node:fs/promises'), path = require('node:path');
if (!process.versions.electron) {
  const run = require('node:child_process').spawnSync(require('electron'), [__filename], { windowsHide: true, timeout: 45000, encoding: 'utf8', env: process.env });
  console.log(run.stdout || '', run.stderr || ''); process.exitCode = run.status === 0 ? 0 : 1;
} else {
  const { app, BrowserWindow } = require('electron');
  (async () => {
    const output = path.resolve(process.env.ZVONOK_NATIVE_OUT || 'artifacts/stages/electron-e6-1/final-pass/cold-start');
    await fs.mkdir(output, { recursive: true });
    process.env.VITE_DEV_SERVER_URL ||= 'http://127.0.0.1:3038';
    let server;
    if (process.env.ZVONOK_SLOW_STARTUP_RESOURCE) {
      server = require('node:http').createServer((request, response) => {
        if (request.url === '/slow-image') return;
        response.end('<!doctype html><body style="background:#181c20;color:white">Приложение готово<script>window.zvonokDesktop?.lifecycle?.ready?.()</script><img src="/slow-image"></body>');
      });
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
      process.env.VITE_DEV_SERVER_URL = `http://127.0.0.1:${server.address().port}`;
    }
    process.env.ZVONOK_DESKTOP_PROFILE = path.join(output, `profile-${Date.now()}`);
    const started = Date.now(), events = [];
    app.on('browser-window-created', (_event, window) => {
      const record = (event, extra = {}) => events.push({ ms: Date.now() - started, window: window.id, event, ...extra });
      window.on('ready-to-show', () => record('ready-to-show'));
      for (const event of ['dom-ready', 'did-finish-load', 'did-stop-loading']) window.webContents.on(event, () => record(event));
      window.webContents.on('did-fail-load', (_event, code, _description, _url, main) => record('did-fail-load', { code, main }));
    });
    await import(require('node:url').pathToFileURL(path.resolve('electron-dist/main.js')).href); await app.whenReady();
    let visible = false, failed = false;
    for (let attempt = 0; attempt < 180; attempt++) {
      const main = BrowserWindow.getAllWindows().find(window => window.webContents.getURL().startsWith('http:'));
      const splash = BrowserWindow.getAllWindows().find(window => window.webContents.getURL().endsWith('startup.html'));
      visible = !!main?.isVisible();
      if (splash && !splash.webContents.isLoading()) failed = await splash.webContents.executeJavaScript("!document.querySelector('a').hidden");
      if (visible || failed) { const window = visible ? main : splash; await fs.writeFile(path.join(output, 'result.png'), (await window.webContents.capturePage()).toPNG()); break; }
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    await fs.writeFile(path.join(output, 'result.json'), JSON.stringify({ status: visible && !failed ? 'PASS' : 'FAIL', visible, failed, events, scope: process.env.ZVONOK_SLOW_STARTUP_RESOURCE ? 'Настоящий Electron, готовый renderer fixture с незавершённым HTTP-ресурсом; ручной retry не используется.' : 'Первый запуск настоящего Electron с настоящим Vite renderer и отдельным профилем; ручной retry не используется.' }, null, 2));
    app.exit(visible && !failed ? 0 : 1);
  })().catch(error => { console.error(error); app.exit(1); });
}
