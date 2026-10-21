const {chromium}=require('C:/Users/Пользователь/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
const browser=await chromium.launch({headless:true});const page=await browser.newPage();const results=[];const errors=[];fs.mkdirSync('artifacts/stages/work/settings-promotion/shell',{recursive:true});
page.on('pageerror',e=>errors.push(e.message));
const record=(name,details={})=>{results.push({name,...details});console.log('PASS',name)};
const entry=()=>page.getByRole('button',{name:'Настройки пользователя',exact:true});
const close=()=>page.getByRole('button',{name:'Закрыть настройки',exact:true}).click();
try{
for(const hash of [false,true]){
await page.goto('http://127.0.0.1:5199/'+(hash?'?hash-router#/dm?roomId=42':'dm?roomId=42'));
await page.getByLabel('Developer Settings V2').uncheck();await entry().click();await page.getByRole('searchbox').waitFor();
await page.getByRole('button',{name:'Закрыть настройки',exact:true}).click();record(`old flag OFF still Workspace ${hash}`);
await page.getByLabel('Модель звонка').selectOption('compact');
const before=await page.locator('#fixture-media-sentinel').getAttribute('data-instance');
const mount=await page.locator('[data-mount]').getAttribute('data-mount');await page.locator('[data-mount] textarea').fill('S1C draft');
await entry().click();await page.getByRole('button',{name:'Закрыть настройки',exact:true}).waitFor();
assert((await page.url()).includes('roomId=42'));assert.equal(await page.locator('#fixture-media-sentinel').getAttribute('data-presentation'),'minimized');
for(const name of ['Аккаунт','Голос и видео','Уведомления','Внешний вид','Горячие клавиши','Приложение']){await page.getByRole('navigation',{name:'Разделы настроек',exact:true}).getByRole('button',{name,exact:true}).click();await page.getByRole('heading',{name,exact:true,level:2}).waitFor();}
await page.getByRole('searchbox').fill('шум');await page.getByRole('button',{name:/Шумоподавление/}).click();await page.locator('#setting-noise').waitFor();
assert(await page.locator('details').evaluate(e=>e.open));assert.equal(await page.evaluate(()=>document.activeElement.id),'setting-noise');
assert.equal(await page.getByRole('button',{name:'Открыть действующие настройки'}).count(),0);
await close();assert.equal(await page.locator('[data-mount] textarea').inputValue(),'S1C draft');assert.equal(await page.locator('[data-mount]').getAttribute('data-mount'),mount);assert.equal(await page.locator('#fixture-media-sentinel').getAttribute('data-instance'),before);
assert(await entry().evaluate(e=>document.activeElement===e));await page.goForward();await page.getByRole('button',{name:'Закрыть настройки',exact:true}).waitFor();await page.goBack();await entry().waitFor();record(`navigation/search/focus/draft/compact/history ${hash}`);
await page.getByLabel('Модель звонка').selectOption('expanded');await entry().click();await page.getByRole('searchbox').waitFor();assert.equal(await page.locator('#fixture-media-sentinel').getAttribute('data-presentation'),'expanded');await page.getByRole('button',{name:'Закрыть настройки',exact:true}).click();record(`expanded Workspace ${hash}`);
await page.getByLabel('Модель звонка').selectOption('compact');await entry().click();
for(const [width,height] of [[1920,1080],[1440,900],[1366,768],[1024,768],[1000,700]]){
await page.setViewportSize({width,height});await page.waitForTimeout(100);
await page.locator('[data-call-dock]:not([hidden])').waitFor();const geometry=await page.evaluate(()=>{const slot=document.getElementById('zvonok-settings-content');return {slot:slot.getBoundingClientRect().toJSON(),overflow:slot.scrollWidth>slot.clientWidth,sidebar:getComputedStyle(document.querySelector('aside')).width,mainCount:document.querySelectorAll('main main').length};});
assert(!geometry.overflow);assert.equal(geometry.sidebar,width<=1100?'224px':'248px');assert.equal(geometry.mainCount,0);record(`responsive ${hash} ${width}x${height}`,geometry);
}
await page.screenshot({path:`artifacts/stages/work/settings-promotion/shell/shell-${hash?'hash':'browser'}.png`});await close();
}
assert.deepEqual(errors,[]);
}finally{fs.writeFileSync('artifacts/stages/work/settings-promotion/shell/browser.json',JSON.stringify({results,errors},null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});




