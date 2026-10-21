const fs = require('node:fs/promises');
const path = require('node:path');
const output = path.resolve(process.env.ZVONOK_NATIVE_OUT || 'artifacts/stages/electron-e6-1/startup', process.env.ZVONOK_STARTUP_FAILURE ? 'failure' : '.');
if (!process.versions.electron) {
  const result = require('node:child_process').spawnSync(require('electron'), [__filename, ...(process.env.ZVONOK_UI_SCALE ? ['--force-device-scale-factor=' + process.env.ZVONOK_UI_SCALE] : [])], { windowsHide: true, timeout: 35000, encoding: 'utf8', env: process.env });
  console.log(result.stdout || '', result.stderr || '');
  process.exitCode = result.status === 0 ? 0 : 1;
} else {
  const { app, BrowserWindow } = require('electron');
  const { pathToFileURL } = require('node:url');
  const assert = require('node:assert/strict');
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  (async () => {
    await fs.mkdir(output, { recursive: true });
    const pending = [];
    let refuse = !!process.env.ZVONOK_STARTUP_FAILURE;
    const server = require('node:http').createServer((_request, response) => {
      if (refuse) { response.destroy(); return; }
      pending.push(() => response.end('<!doctype html><body style="background:#181c20;color:white">Проверка окна Zvonok<script>window.zvonokDesktop.lifecycle.ready()</script></body>'));
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    process.env.VITE_DEV_SERVER_URL = `http://127.0.0.1:${server.address().port}`;
    process.env.ZVONOK_DESKTOP_PROFILE = path.join(output, `native-profile-${Date.now()}`);
    const started = Date.now();
    await import(pathToFileURL(path.resolve('electron-dist/main.js')).href);
    await app.whenReady();
    let splash;
    for (let attempt = 0; attempt < 100; attempt++) {
      splash = BrowserWindow.getAllWindows().find(window => window.webContents.getURL().endsWith('startup.html'));
      if (splash && !splash.webContents.isLoading()) break;
      await sleep(100);
    }
    assert(splash, 'Native splash exists');
    const secondInstance = async () => {
      const child = require('node:child_process').spawn(process.execPath, ['.'], { env: process.env, windowsHide: true, stdio: 'ignore' });
      await new Promise((resolve, reject) => { child.once('exit', resolve); child.once('error', reject); });
      await sleep(200);
    };
    await secondInstance();
    assert.equal(BrowserWindow.getAllWindows().filter(w => w.webContents.getURL().endsWith('startup.html')).length, 1, 'Second invocation preserves one splash');
    const capture = async (window, name) => fs.writeFile(path.join(output, `${name}.png`), (await window.webContents.capturePage()).toPNG());
    if (refuse) {
      for (let attempt = 0; attempt < 100; attempt++) {
        if (await splash.webContents.executeJavaScript("!document.querySelector('a').hidden")) break;
        await sleep(100);
      }
      assert(await splash.webContents.executeJavaScript("!document.querySelector('a').hidden"), 'Recoverable failure is displayed');
      assert(!BrowserWindow.getAllWindows().some(w => w.webContents.getURL().startsWith('http:') && w.isVisible()), 'Failed renderer stays hidden');
      await capture(splash, 'renderer-failure');
      refuse = false;
      await splash.webContents.executeJavaScript("document.querySelector('a').click()");
      await sleep(200);
    }
    await capture(splash, 'starting');
    const splashMs = Date.now() - started;
    for (const [name, message, percent, failed] of [['starting-state', 'Запускаем Zvonok…', null, false], ['prerequisites', 'Проверяем компоненты приложения…', null, false], ['preparing', 'Подготавливаем обновление…', null, false], ['checking', 'Проверяем обновления…', null, false], ['downloading', 'Загружаем обновление…', 42, false], ['recoverable', 'Не удалось открыть Zvonok', null, true]]) {
      await splash.webContents.executeJavaScript(`window.renderStartup(${JSON.stringify({ message, percent, failed })})`);
      await sleep(180); await capture(splash, name);
    }
    for (const respond of pending) respond();
    for (let attempt = 0; attempt < 100 && !splash.isDestroyed(); attempt++) await sleep(100);
    assert(splash.isDestroyed(), 'Splash closes after renderer ready');
    const main = BrowserWindow.getAllWindows().find(window => window.webContents.getURL().startsWith('http:'));
    assert(main?.isVisible(), 'Main is visible');
    const mainMs = Date.now() - started;
    main.webContents.closeDevTools();
    await sleep(200);
    main.hide();
    await secondInstance();
    assert(main.isVisible(), 'Second invocation restores tray instance');
    assert(main.isFocused(), 'Restored main receives focus');
    await capture(main, 'main-transition');
    await fs.writeFile(path.join(output, 'native-results.json'), JSON.stringify({ status: 'PASS', splashMs, mainMs, focused: main.isFocused(), secondInstance: true, trayRestore: true, rendererFailureRetry: !!process.env.ZVONOK_STARTUP_FAILURE, scope: 'Настоящий Electron main с HTTP fixture renderer; состояния updater на снимках заданы тестом для проверки оформления.' }, null, 2));
    server.closeAllConnections(); server.close(); app.quit();
  })().catch(async error => { await fs.writeFile(path.join(output, 'native-failure.txt'), String(error.stack)); console.error(error); app.exit(1); });
}
