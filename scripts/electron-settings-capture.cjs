const fs = require('node:fs/promises');
const path = require('node:path');
if (!process.versions.electron) {
  const result = require('node:child_process').spawnSync(require('electron'), [__filename, ...(process.env.ZVONOK_UI_SCALE ? ['--force-device-scale-factor=' + process.env.ZVONOK_UI_SCALE] : []), ...(process.env.ZVONOK_REDUCED_MOTION ? ['--force-prefers-reduced-motion=reduce'] : [])], { windowsHide: true, timeout: 30000, encoding: 'utf8', env: process.env });
  console.log(result.stdout || '', result.stderr || ''); process.exitCode = result.status === 0 ? 0 : 1;
} else {
  const { app, BrowserWindow } = require('electron');
  (async () => {
    const output = path.resolve(process.env.ZVONOK_NATIVE_OUT || 'artifacts/stages/electron-e6-1/settings'); await fs.mkdir(output, { recursive: true });
    process.env.VITE_DEV_SERVER_URL = 'http://127.0.0.1:5199/dm?roomId=42#settings-v2/application';
    process.env.ZVONOK_DESKTOP_PROFILE = path.join(output, `profile-${Date.now()}`);
    await import(require('node:url').pathToFileURL(path.resolve('electron-dist/main.js')).href); await app.whenReady();
    let main;
    for (let attempt = 0; attempt < 100; attempt++) {
      main = BrowserWindow.getAllWindows().find(w => w.webContents.getURL().startsWith('http:'));
      if (main && !main.webContents.isLoading() && await main.webContents.executeJavaScript("document.body.textContent.includes('Автоматические обновления пока недоступны')")) break;
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    require('node:assert/strict')(await main.webContents.executeJavaScript("document.body.textContent.includes('Автоматические обновления пока недоступны')"));
    await new Promise(resolve => setTimeout(resolve, 500));
    await main.webContents.executeJavaScript("document.getElementById('setting-about').scrollIntoView({block:'start'})");
    await new Promise(resolve => setTimeout(resolve, 250));
    await fs.writeFile(path.join(output, 'application.png'), (await main.webContents.capturePage()).toPNG());
    if (process.env.ZVONOK_UPDATE_UI) {
      const assert = require('node:assert/strict');
      const wait = () => new Promise(resolve => setTimeout(resolve, 250));
      const capture = async name => { await wait(); await fs.writeFile(path.join(output, name + '.png'), (await main.webContents.capturePage()).toPNG()); };
      const state = { status: 'ready', installedVersion: '1.0.0', version: '1.1.0', staging: false };
      for (const status of ['checking', 'downloading', 'error']) {
        main.webContents.send('updates:state', { ...state, status, percent: status === 'downloading' ? 42 : undefined });
        await capture(status);
      }
      await main.webContents.executeJavaScript("window.settingsFixture.dispatch({type:'call/startOutgoing',payload:{chatRoomId:42}})");
      const focus = await main.webContents.executeJavaScript('document.activeElement?.outerHTML');
      main.webContents.send('updates:state', state); await capture('ready-during-call');
      assert(await main.webContents.executeJavaScript("document.querySelector('[aria-label=\"Обновление приложения\"] button').disabled"));
      assert(await main.webContents.executeJavaScript("[...document.querySelectorAll('[aria-label=\"Обновления Zvonok\"] button')].find(b=>b.textContent==='После завершения звонка')?.disabled"));
      assert.equal(await main.webContents.executeJavaScript('document.activeElement?.outerHTML'), focus, 'Ready notice never steals focus');
      await main.webContents.executeJavaScript("window.settingsFixture.dispatch({type:'call/endCallLocally'})");
      await capture('ready-after-call');
      assert(!await main.webContents.executeJavaScript("document.querySelector('[aria-label=\"Обновление приложения\"] button').disabled"));
      await main.webContents.executeJavaScript("[...document.querySelectorAll('[aria-label=\"Обновление приложения\"] button')].find(b=>b.textContent==='Позже').click()");
      await wait(); main.webContents.send('updates:state', state); await wait();
      assert(!await main.webContents.executeJavaScript("!!document.querySelector('[aria-label=\"Обновление приложения\"]')"), 'Dismissal survives repeated state events');
      main.webContents.send('updates:state', { ...state, version: '1.2.0' }); await wait();
      assert(await main.webContents.executeJavaScript("!!document.querySelector('[aria-label=\"Обновление приложения\"]')"), 'New target is announced');
      main.webContents.closeDevTools(); main.focus(); await wait();
      await main.webContents.executeJavaScript("document.querySelector('[aria-label=\"Обновление приложения\"] button').focus()");
      main.webContents.sendInputEvent({ type:'keyDown', keyCode:'Tab' });
      main.webContents.sendInputEvent({ type:'keyUp', keyCode:'Tab' }); await wait();
      assert(await main.webContents.executeJavaScript("document.activeElement.textContent==='Позже' && document.activeElement.matches(':focus-visible')"), 'Keyboard Tab reaches Later with visible focus');
      await capture('keyboard-focus');
      await fs.writeFile(path.join(output, 'ui-results.json'), JSON.stringify({ status: 'PASS', keyboardFocus: true, scope: 'Настоящий BrowserWindow, Settings и typed bridge; updater/call states заданы только для проверки UI, installer не запускался', scale: await main.webContents.executeJavaScript('devicePixelRatio'), reducedMotion: await main.webContents.executeJavaScript("matchMedia('(prefers-reduced-motion: reduce)').matches") }, null, 2));
    }
    app.exit(0);
  })().catch(error => { console.error(error); app.exit(1); });
}
