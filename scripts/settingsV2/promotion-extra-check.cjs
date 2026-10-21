const {chromium}=require(process.env.STAGE10_PLAYWRIGHT || 'C:/Users/Пользователь/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const out='artifacts/stages/work/settings-promotion/extra';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1440,height:900}}),results=[],errors=[];
 page.on('pageerror',e=>errors.push(e.message));const record=name=>{results.push({name,status:'PASS'});console.log('PASS',name);};
 const entry=()=>page.getByRole('button',{name:'Настройки пользователя',exact:true}).click();
 const close=()=>page.getByRole('button',{name:'Закрыть настройки',exact:true}).click();
 try{
  for(const hash of [false,true]) for(const route of ['conference/fixture','invite/fixture']){
   const base='http://127.0.0.1:5199/'+(hash?'?hash-router#/'+route:route);
   await page.goto(base);await page.locator('[data-mount]').waitFor();const mount=await page.locator('[data-mount]').getAttribute('data-mount');
   await entry();await page.getByRole('searchbox').waitFor();assert.equal(await page.locator('#zvonok-settings-content').count(),1);
   assert(!(await page.locator('[data-mount]').isVisible()));await close();assert.equal(await page.locator('[data-mount]').getAttribute('data-mount'),mount);
   assert(await page.locator('[data-mount]').isVisible());assert((await page.url()).includes(route));
   await page.goto(base+'#settings-v2/appearance');await page.getByRole('group',{name:'Темы Zvonok'}).waitFor();await close();
   record(`${route} ${hash?'HashRouter':'BrowserRouter'}: entry/direct link/single host/return/retained route subtree`);
  }
  await page.goto('http://127.0.0.1:5199/dm?roomId=42');
  await page.getByTitle('Мой профиль',{exact:true}).click();await page.getByRole('button',{name:'Редактировать профиль',exact:true}).click();
  await page.getByRole('searchbox').waitFor();assert.equal(await page.getByRole('dialog').count(),0);
  await page.getByRole('searchbox').focus();assert(await page.getByRole('searchbox').evaluate(e=>document.activeElement===e));await close();record('own profile edit entry artifacts/stages/releases parent modal and focus trap');
  await entry();
  await page.addStyleTag({content:'.fixture-tools,#fixture-media-sentinel{display:none!important}'});
  for(const width of [1920,1440,1024,800]){
   await page.setViewportSize({width,height:900});
   await page.locator('.fixture-stage').screenshot({path:`${out}/settings-normal-${width}.png`});
   const geometry=await page.getByRole('region',{name:'Настройки',exact:true}).evaluate(e=>({overflow:e.scrollWidth>e.clientWidth,headings:e.querySelectorAll('h1').length}));
   assert(!geometry.overflow);assert.equal(geometry.headings,1);
  }record('clean production shell composition at 1920/1440/1024/800; only fixture tools hidden');
  await page.goto('http://127.0.0.1:3017/scripts/call-layout-preview.html?count=4&b1&stageD');await page.locator('[data-layout="grid"] video').first().waitFor();
  await page.getByRole('button',{name:'Следовать за говорящим',exact:true}).click();await page.evaluate(()=>window.stageFixture.speech([0]));await page.waitForTimeout(2500);
  await page.getByRole('button',{name:'Фокус',exact:true}).click();await page.getByRole('button',{name:'Закрепить',exact:true}).click();await page.getByRole('button',{name:'Кино',exact:true}).click();
  await page.getByRole('button',{name:'Настройки звука и устройств',exact:true}).click();await page.getByRole('searchbox').waitFor();
  await page.getByRole('dialog',{name:'Настройки',exact:true}).evaluate(e=>{
   const controls=[...e.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)')].filter(n=>n.getClientRects().length&&!n.closest('[hidden]'));
   controls.at(-1).focus();
  });
  await page.keyboard.press('Tab');assert(await page.getByRole('searchbox').evaluate(e=>document.activeElement===e));
  await page.getByRole('searchbox').press('Shift+Tab');assert(await page.getByRole('dialog',{name:'Настройки',exact:true}).evaluate(e=>e.contains(document.activeElement)));
  record('Expanded overlay keyboard focus wraps within Settings');
  await page.getByRole('searchbox').press('Escape');await page.getByRole('searchbox').waitFor({state:'hidden'});assert.equal(await page.evaluate(()=>window.stageFixture.view().isTheaterMode),true);
  await page.waitForFunction(()=>!document.querySelector('[data-call-stage]').inert);
  await page.keyboard.press('Escape');await page.waitForFunction(()=>!window.stageFixture.view().isTheaterMode);record('Escape closes Settings first and exits Cinema only on next Escape');
  assert.deepEqual(errors,[]);
 }catch(e){errors.push(e.stack);console.error(e);process.exitCode=1;await page.screenshot({path:out+'/failure.png'});}
 finally{fs.writeFileSync(out+'/results.json',JSON.stringify({results,errors,realMedia:'NOT RUN'},null,2));await browser.close();}
})();
