const {chromium} = require('C:/Users/Пользователь/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const out = 'artifacts/stages/work/settings-visual';
fs.mkdirSync(out, {recursive:true});
(async () => {
  const browser = await chromium.launch({headless:true, args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
  const page = await browser.newPage({viewport:{width:1740,height:900},permissions:['microphone','camera']});
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  const shot=async name=>{await page.waitForTimeout(240);await page.screenshot({path:out+'/'+name+'.png'});};
  const category = name => page.getByRole('navigation',{name:'Разделы настроек',exact:true}).getByRole('button',{name,exact:true}).click();
  try {
    await page.goto('http://127.0.0.1:5199/dm?roomId=42#settings-v2/media');
    await page.locator('#setting-microphone').waitFor();
    if(process.argv.includes('--before')) { await page.screenshot({path:out+'/before-media.png'}); return; }
    for (const [name,id] of [['Микрофон','microphone'],['Наушники','headphones'],['Камера','camera'],['Экран','screen'],['Обработка','noise']]) {
      await page.getByRole('tab',{name,exact:true}).click();
      await page.locator('#setting-'+id).waitFor();
      assert.equal(await page.locator('[data-media-panel]').count(),1);
      assert.equal(await page.getByRole('region',{name:'Содержимое настроек',exact:true}).evaluate(e=>e.scrollTop),0);
      await shot(id);
    }
    await page.getByRole('button',{name:'Открыть',exact:true}).click();
    await page.getByLabel('High-pass filter',{exact:true}).waitFor();
    await shot('advanced-expanded');
    for(const name of ['Аккаунт','Внешний вид','Уведомления','Горячие клавиши','Приложение']) {
      await category(name); await shot({'Аккаунт':'account','Внешний вид':'appearance','Уведомления':'notifications','Горячие клавиши':'hotkeys','Приложение':'application'}[name]);
    }
    const search=page.getByRole('searchbox',{name:'Поиск по настройкам',exact:true});
    await search.fill('эхоподавление'); await shot('search-results');
    await search.press('ArrowDown'); await page.keyboard.press('Enter');
    assert(await page.getByLabel('Эхоподавление',{exact:true}).isVisible());
    assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('aria-label')),'Эхоподавление');
    await shot('search-target');
    await page.goBack(); await page.getByRole('heading',{name:'Приложение',exact:true}).waitFor();
    await page.goForward(); await page.getByLabel('Эхоподавление',{exact:true}).waitFor();
    await category('Голос и видео');
    const preference=await page.getByLabel('Эхоподавление',{exact:true}).isChecked();
    await page.getByLabel('Эхоподавление',{exact:true}).press('Space');
    await page.waitForFunction(previous => window.settingsFixture.view().device.isEchoCancellationEnabled !== previous, preference);
    assert.equal(await page.getByLabel('Эхоподавление',{exact:true}).isChecked(),!preference);
    await page.getByRole('tab',{name:'Камера',exact:true}).click();
    await page.waitForURL('**#settings-v2/media/camera');
    await page.locator('#setting-camera').waitFor();
    await page.goBack(); await page.getByLabel('Эхоподавление',{exact:true}).waitFor();
    assert.equal(await page.getByLabel('Эхоподавление',{exact:true}).isChecked(),!preference);
    await page.getByRole('tab',{name:'Микрофон',exact:true}).click();
    for(const [width,height] of [[1920,1080],[1740,900],[1440,900],[1366,768],[1024,768],[800,900],[600,900]]) {
      await page.setViewportSize({width,height});
      assert(await page.locator('#zvonok-settings-content').evaluate(e=>e.scrollWidth<=e.clientWidth));
      assert(await page.getByRole('region',{name:'Содержимое настроек',exact:true}).evaluate(e=>e.scrollWidth<=e.clientWidth));
      await shot(`responsive-${width}`);
    }
    await page.emulateMedia({reducedMotion:'reduce'});
    assert.equal(await page.locator('[data-media-panel]').evaluate(e=>getComputedStyle(e).animationName),'none');
    await page.setViewportSize({width:1740,height:900});
    const geometry=await page.evaluate(()=>{
      const content=document.querySelector('[aria-label="Содержимое настроек"]').getBoundingClientRect();
      const canvas=document.querySelector('[data-media-panel]').getBoundingClientRect();
      const search=document.querySelector('#settings-search').getBoundingClientRect();
      return {contentCenter:content.x+content.width/2,canvasCenter:canvas.x+canvas.width/2,searchCenter:search.x+search.width/2,canvasWidth:canvas.width};
    });
    assert(Math.abs(geometry.contentCenter-geometry.canvasCenter)<2);
    assert(Math.abs(geometry.contentCenter-geometry.searchCenter)<2);
    assert(geometry.canvasWidth<=1070);
    await search.fill('компрессор'); await search.press('ArrowDown'); await page.keyboard.press('Enter');
    await page.getByLabel('High-pass filter',{exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('aria-label')),'High-pass filter');
    await shot('search-advanced-target');
    await page.goto('http://127.0.0.1:5199/dm?roomId=42#settings-v2/media/echo');
    await page.getByLabel('Эхоподавление',{exact:true}).waitFor();
    await page.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='Эхоподавление');
    await page.goto('http://127.0.0.1:3017/scripts/call-layout-preview.html?count=4&b1&stageD');
    await page.locator('[data-call-stage] video').first().waitFor();
    await page.getByRole('button',{name:'Настройки звука и устройств',exact:true}).click();
    await page.getByRole('searchbox').waitFor();
    await shot('expanded-call-settings');
    assert.deepEqual(errors,[]);
    fs.writeFileSync(out+'/visual-results.json',JSON.stringify({status:'PASS',errors,geometry},null,2));
  } catch(e) {
    await page.screenshot({path:out+'/visual-failure.png'});
    fs.writeFileSync(out+'/visual-results.json',JSON.stringify({status:'FAIL',error:e.stack,url:page.url()},null,2));
    throw e;
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
