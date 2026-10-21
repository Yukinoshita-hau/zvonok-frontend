const { chromium } = require(process.env.STAGE10_PLAYWRIGHT || 'C:/Users/Пользователь/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const out = process.env.STAGE_A_OUTPUT || 'artifacts/stages/call-layout-stage-a-evidence';
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const results = [], errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const open = async (width, height, count, mixed = false) => {
    await page.setViewportSize({ width, height });
    await page.goto(`http://127.0.0.1:3017/scripts/call-layout-preview.html?count=${count}${mixed ? '&mixed' : ''}`);
    await page.waitForSelector('[data-card-id]');
    await page.waitForTimeout(250);
  };
  const measure = async () => page.evaluate(() => {
    const rect = el => { const r = el.getBoundingClientRect(); return { x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom }; };
    const grid = document.querySelector('[data-call-grid]');
    const controls = document.querySelector('[aria-label="Управление звонком"]');
    return { viewport:[innerWidth,innerHeight], grid: grid && rect(grid), capacity: grid && Number(grid.dataset.capacity),
      controls:rect(controls), tiles: [...document.querySelectorAll('[data-card-id]')].map(el => ({ id:el.dataset.cardId,...rect(el) })),
      overflow: document.documentElement.scrollWidth > innerWidth,
      videos:[...document.querySelectorAll('video')].map(v => ({ width:v.videoWidth,height:v.videoHeight })),
      counts:window.stageFixture.counts() };
  });
  const check = async (name) => {
    const m = await measure();
    assert(!m.overflow, `${name}: horizontal overflow`);
    assert(m.controls.bottom <= m.viewport[1] + 1, `${name}: controls outside viewport`);
    for (const t of m.tiles) {
      assert(t.width > 0 && t.height > 0, `${name}: empty tile`);
      assert(t.bottom <= m.controls.y + 1, `${name}: toolbar overlap`);
      assert(t.x >= m.grid.x - 1 && t.right <= m.grid.right + 1, `${name}: tile outside grid`);
    }
    assert.equal(m.counts.connections,0); assert.equal(m.counts.publications,0);
    assert(await page.locator('[aria-label="Управление звонком"] button').evaluateAll(nodes => nodes.every(n => {
      const r = n.getBoundingClientRect(); return r.x >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1;
    })), `${name}: control clipped`);
    results.push({ name,status:'PASS',...m });
    console.log('PASS',name, 'stage',Math.round(m.grid.width),Math.round(m.grid.height),'tiles',m.tiles.length,'capacity',m.capacity);
  };
  try {
    for (const [w,h,n] of [[1440,900,2],[1440,900,4],[1440,900,8],[1366,768,4],[1366,768,6],[1024,600,2],[1024,600,4],[1024,600,6],[1920,1080,9],[1920,1080,16],[1024,768,6],[1000,700,6]]) {
      await open(w,h,n); await check(`${w}x${h}-${n}`);
      if (n===16 || w===1024 && h===600 && n===6) await page.screenshot({path:`${out}/${w}x${h}-${n}.png`});
    }
    await open(1440,900,8,true); await check('mixed-aspects');
    assert((await measure()).videos.some(v=>v.height>v.width));
    await page.screenshot({path:`${out}/mixed-aspects.png`});
    const before = await page.locator('[data-card-id]').evaluateAll(nodes => {window.__tiles=nodes; return nodes.map(n=>n.dataset.cardId);});
    await page.evaluate(()=>window.stageFixture.speak()); await page.waitForTimeout(100);
    assert(await page.evaluate(()=>window.__tiles.every(n=>n.isConnected)),'VAD remounted tiles');
    await page.evaluate(()=>window.stageFixture.camera(false)); await page.waitForTimeout(100);
    assert(await page.evaluate(()=>window.__tiles.every(n=>n.isConnected)),'camera off remounted tiles');
    await page.evaluate(()=>window.stageFixture.camera(true)); await page.waitForTimeout(100);
    await page.evaluate(()=>window.stageFixture.replaceTrack()); await page.waitForTimeout(100);
    assert(await page.evaluate(()=>window.__tiles.every(n=>n.isConnected)),'track replacement remounted tiles');
    assert.deepEqual(await page.locator('[data-card-id]').evaluateAll(ns=>ns.map(n=>n.dataset.cardId)),before);
    await page.setViewportSize({width:1366,height:768}); await page.waitForTimeout(100); await check('resize-preserves-nodes');
    assert(await page.evaluate(()=>window.__tiles.every(n=>n.isConnected)),'resize remounted tiles');
    await page.getByRole('button',{name:'Переписка звонка',exact:true}).click(); await page.waitForTimeout(200); await check('chat-open');
    await page.screenshot({path:`${out}/chat-open.png`});
    await page.getByRole('button',{name:'Закрыть чат',exact:true}).click();
    await page.locator('[data-card-id="person-1"]').click();
    await page.waitForTimeout(150);
    assert(await page.getByRole('button',{name:'Кино',exact:true}).isEnabled());
    await page.getByRole('button',{name:'Кино',exact:true}).click(); await page.waitForTimeout(150);
    assert.equal(await page.locator('[data-cinema="true"]').count(),1);
    await page.setViewportSize({width:1024,height:600});
    await page.getByRole('button',{name:'Выйти из кино · Esc',exact:true}).click({force:true});
    await page.getByRole('button',{name:'Сетка',exact:true}).click(); await page.waitForTimeout(150); await check('focus-cinema-grid');
    await page.evaluate(()=>window.stageFixture.share()); await page.waitForTimeout(150);
    // Manual Grid remains Grid when a new share is published.
    assert.equal(await page.locator('[data-layout="grid"]').count(),1);
    await page.getByRole('button',{name:'Контент',exact:true}).click(); await page.waitForTimeout(150);
    assert.equal(await page.locator('[data-layout="screen"]').count(),1);
    assert.equal(await page.locator('[data-call-grid] [data-card-id="screen:TR_SCREEN"]').count(),0);
    assert.equal(await page.locator('[data-layout="screen"] video').first().evaluate(v=>getComputedStyle(v).objectFit),'contain');
    await page.getByRole('button',{name:'Масштаб камеры',exact:true}).click();
    assert.equal(await page.locator('[data-layout="screen"] video').first().evaluate(v=>getComputedStyle(v).objectFit),'contain');
    await page.screenshot({path:`${out}/screen-focus.png`});
    await page.getByRole('button',{name:'Сетка',exact:true}).click(); await page.waitForTimeout(150);
    await page.getByRole('button',{name:'Переписка звонка',exact:true}).click(); await page.waitForTimeout(150); await check('small-chat-open');
    await page.getByRole('button',{name:'Закрыть чат',exact:true}).click();
    const next = page.getByRole('button',{name:'Следующая страница участников'});
    if(await next.count()) { await next.click(); await page.waitForTimeout(100); await check('pagination'); }
    await page.evaluate(()=>window.stageFixture.reconnect(false)); await page.waitForTimeout(100);
    const reconnectIds = await page.locator('[data-card-id]').evaluateAll(ns=>ns.map(n=>n.dataset.cardId));
    assert(reconnectIds.length>0);
    await page.evaluate(()=>window.stageFixture.reconnect(true)); await page.waitForTimeout(100);
    assert.deepEqual(await page.locator('[data-card-id]').evaluateAll(ns=>ns.map(n=>n.dataset.cardId)),reconnectIds);
    for(let i=0;i<6;i++) await page.evaluate(()=>window.stageFixture.leave());
    await page.waitForTimeout(150); await check('leave-clamps-page');
    await page.getByRole('button',{name:'Свернуть звонок',exact:true}).click(); await page.waitForTimeout(100);
    assert(await page.getByText('Говорит Участник 1',{exact:true}).isVisible());
    await page.screenshot({path:`${out}/mini-speaker.png`});
    await page.evaluate(()=>window.stageFixture.speak()); await page.waitForTimeout(850);
    assert(await page.getByText('Никто не говорит',{exact:true}).isVisible());
    await page.getByRole('button',{name:'Развернуть',exact:true}).click(); await page.waitForTimeout(150); await check('mini-restore');
    assert.deepEqual(errors,[]);
  } catch(error) {
    results.push({status:'FAIL',error:error.stack}); console.error(error); process.exitCode=1;
    console.error('Fixture failure state',await page.evaluate(()=>({url:location.href,title:document.title,body:document.body.innerText.slice(0,2000),call:window.stageFixture?.view(),cards:document.querySelectorAll('[data-card-id]').length})).catch(String));
    await page.screenshot({path:`${out}/failure.png`,timeout:5000}).catch(e=>console.error('Failure screenshot:',String(e)));
  }
  fs.writeFileSync(`${out}/results.json`,JSON.stringify({media:'SYNTHETIC CANVAS; real app components, no LiveKit server',results,errors},null,2));
  await browser.close();
})();
