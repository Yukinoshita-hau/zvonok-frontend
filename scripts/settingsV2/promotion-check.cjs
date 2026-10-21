const {chromium} = require(process.env.STAGE10_PLAYWRIGHT || 'C:/Users/Пользователь/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict'), fs = require('node:fs');
const out = process.env.SETTINGS_PROMOTION_OUTPUT || 'artifacts/stages/work/settings-promotion/default';
fs.mkdirSync(out, {recursive:true});
(async () => {
  const browser = await chromium.launch(), results = [], errors = [];
  const record = name => {results.push({name,status:'PASS'}); console.log('PASS',name);};
  let page;
  const entry = () => page.getByRole('button',{name:'Настройки пользователя',exact:true}).click();
  const close = () => page.getByRole('button',{name:'Закрыть настройки',exact:true}).click();
  const category = name => page.getByRole('navigation',{name:'Разделы настроек',exact:true}).getByRole('button',{name,exact:true}).click();
  try {
    for (const hash of [false,true]) for (const flag of [null,'0','1']) {
      const context = await browser.newContext({viewport:{width:1440,height:900}});
      page = await context.newPage(); page.on('pageerror',e=>errors.push(e.message));
      if (flag !== null) await page.addInitScript(value=>localStorage.setItem('zvonok.settingsV2',value),flag);
      const base = 'http://127.0.0.1:5199/'+(hash?'?hash-router#/dm?roomId=42':'dm?roomId=42');
      await page.goto(base); await entry();
      await page.getByRole('heading',{name:'Настройки',exact:true}).waitFor();
      assert.equal(await page.getByRole('dialog').count(),0);
      assert(!/SETTINGS 2\.0|Экспериментальная версия|Открыть действующие настройки/.test(await page.getByRole('region',{name:'Настройки',exact:true}).innerText()));
      await page.reload(); await page.getByRole('searchbox').waitFor(); await close();
      const mount = await page.locator('[data-mount]').getAttribute('data-mount');
      await page.locator('[data-mount] textarea').fill('Promotion draft');
      await page.getByLabel('Модель звонка').selectOption('compact');
      const instance = await page.locator('#fixture-media-sentinel').getAttribute('data-instance');
      await entry();
      for (const name of ['Аккаунт','Голос и видео','Уведомления','Внешний вид','Горячие клавиши','Приложение']) await category(name);
      await page.getByRole('searchbox').fill('шум'); await page.getByRole('searchbox').press('ArrowDown'); await page.keyboard.press('Enter');
      await page.locator('#setting-noise').waitFor(); assert.equal(await page.evaluate(()=>document.activeElement.id),'setting-noise');
      assert(await page.locator('details').evaluate(e=>e.open));
      await close(); assert.equal(await page.locator('[data-mount]').getAttribute('data-mount'),mount);
      assert.equal(await page.locator('[data-mount] textarea').inputValue(),'Promotion draft');
      await page.goForward(); await page.getByRole('searchbox').waitFor(); await page.goBack();
      await page.getByLabel('Модель звонка').selectOption('expanded'); await entry(); await page.getByRole('searchbox').waitFor();
      assert.equal(await page.locator('#fixture-media-sentinel').getAttribute('data-presentation'),'expanded');
      assert.equal(await page.locator('#fixture-media-sentinel').getAttribute('data-instance'),instance);
      await page.getByRole('searchbox').fill('камера'); await page.getByRole('searchbox').press('Escape'); assert.equal(await page.getByRole('searchbox').inputValue(),'');
      await page.getByRole('searchbox').press('Escape'); await page.getByRole('searchbox').waitFor({state:'hidden'});
      assert.equal(await page.locator('#fixture-media-sentinel').getAttribute('data-presentation'),'expanded');
      await page.getByLabel('Модель звонка').selectOption('idle'); await entry();
      for (const width of [1920,1440,1024,800]) {
        await page.setViewportSize({width,height:900}); await category('Аккаунт');
        assert(await page.locator('#zvonok-settings-content').evaluate(e=>e.scrollWidth<=e.clientWidth));
        const search = await page.getByRole('searchbox').boundingBox(); assert(search.width<=700);
        if (flag === null && !hash) await page.screenshot({path:`${out}/settings-${width}.png`});
      }
      await close(); await page.evaluate(()=>localStorage.setItem('zvonok.settingsUI','legacy')); await entry();
      await page.getByRole('dialog',{name:'Настройки пользователя'}).waitFor(); await close();
      await page.evaluate(()=>localStorage.removeItem('zvonok.settingsUI')); await entry(); await page.getByRole('searchbox').waitFor();
      await page.goto(base+'#settings-v2/media/noise'); await page.locator('#setting-noise').waitFor(); assert(await page.locator('details').evaluate(e=>e.open));
      await close(); assert(!(await page.url()).includes('settings-v2'));
      record(`${hash?'HashRouter':'BrowserRouter'} flag=${flag}: default/reload/search/history/compact/expanded/Escape/rollback/deep link/responsive`);
      await context.close();
    }
    page = await browser.newPage({viewport:{width:1440,height:900}}); page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:3017/scripts/call-layout-preview.html?count=4&b1&stageD');
    await page.locator('[data-call-stage] video').first().waitFor();
    await page.evaluate(()=>{window.promotionRoom=window.stageFixture.room;window.promotionVideos=[...document.querySelectorAll('video')];window.promotionState=window.stageFixture.view();});
    await page.getByRole('button',{name:'Настройки звука и устройств',exact:true}).click(); await page.getByRole('searchbox').waitFor();
    assert(await page.locator('[data-call-stage]').evaluate(e=>e.inert));
    await page.getByRole('searchbox').press('Escape');
    assert.deepEqual(await page.evaluate(()=>window.stageFixture.view()),await page.evaluate(()=>window.promotionState));
    assert(await page.evaluate(()=>window.promotionRoom===window.stageFixture.room&&window.promotionVideos.every(v=>v.isConnected)));
    assert.deepEqual(await page.evaluate(()=>window.stageFixture.counts()),{connections:0,publications:0});
    assert(!(await page.locator('[data-call-stage]').evaluate(e=>e.inert)));
    record('actual Expanded CallUi: Workspace entry, Escape, same Room/state/video DOM, no connect/publish');
    assert.deepEqual(errors,[]);
  } catch (e) {errors.push(e.stack); console.error(e); process.exitCode=1; if(page) await page.screenshot({path:out+'/failure.png'});}
  finally {fs.writeFileSync(out+'/results.json',JSON.stringify({results,errors,realMedia:'NOT RUN'},null,2));await browser.close();}
})();
