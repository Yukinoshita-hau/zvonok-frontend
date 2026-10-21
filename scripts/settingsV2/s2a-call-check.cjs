const {chromium}=require(process.env.STAGE10_PLAYWRIGHT || 'C:/Users/Пользователь/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const out=process.env.S2A_CALL_EVIDENCE || 'artifacts/stages/work/settings-promotion/call-appearance'; fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1440,height:900}});const results=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
const record=name=>{results.push({name,status:'PASS'});console.log('PASS',name);};
async function apply(name,scene){
 const before=await page.evaluate(()=>{window.s2aRoom=window.stageFixture.room;window.s2aVideos=[...document.querySelectorAll('video')];return window.stageFixture.view();});
 await page.getByRole('button',{name:scene==='dock'?'Настройки пользователя':'Настройки звука и устройств',exact:true}).click();
 const dialog=page.locator('[aria-label="Настройки"]');await dialog.getByRole('button',{name:'Внешний вид',exact:true}).click();
 await dialog.getByRole('group',{name:'Темы Zvonok'}).getByRole('button',{name:new RegExp('^'+name)}).click();
 if(name==='Своя'){await dialog.locator('input[data-color=bgPrimary]').fill(({cinema:'#152231',content:'#192638',split:'#1b2839',dock:'#1c293a'})[scene]);await dialog.getByRole('button',{name:'Применить основной фон',exact:true}).click();}
 await page.getByRole('button',{name:'Закрыть настройки',exact:true}).click();
 assert.deepEqual(await page.evaluate(()=>window.stageFixture.view()),before);
 assert(await page.evaluate(()=>window.s2aRoom===window.stageFixture.room&&window.s2aVideos.every(v=>v.isConnected)));
 assert.deepEqual(await page.evaluate(()=>window.stageFixture.counts()),{connections:0,publications:0});
 assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),name==='Своя'?'custom':'dark');
 await page.screenshot({path:`${out}/${scene}-${name==='Своя'?'custom':'dark'}.png`});record(`${scene} ${name}: same Room, call state, source selection, tracks and video DOM; no connection/publication`);
}
try{
 await page.goto('http://127.0.0.1:3017/scripts/call-layout-preview.html?count=4&b1&stageD');await page.locator('[data-layout="grid"] video').first().waitFor();
 await page.getByRole('button',{name:'Следовать за говорящим',exact:true}).click();await page.evaluate(()=>window.stageFixture.speech([0]));await page.waitForTimeout(2500);
 await page.getByRole('button',{name:'Фокус',exact:true}).click();await page.getByRole('button',{name:'Закрепить',exact:true}).click();await page.getByRole('button',{name:'Кино',exact:true}).click();
 for(const name of ['Тёмная','Своя'])await apply(name,'cinema');await page.keyboard.press('Escape');
 await page.evaluate(()=>window.stageFixture.share());await page.getByRole('button',{name:'Контент',exact:true}).click();await page.locator('[data-content-view]').waitFor();
 for(const name of ['Тёмная','Своя'])await apply(name,'content');
 await page.getByRole('button',{name:'Split',exact:true}).click();for(const name of ['Тёмная','Своя'])await apply(name,'split');
 await page.locator('[data-call-stage]').getByRole('button',{name:'Свернуть звонок',exact:true}).click();for(const name of ['Тёмная','Своя'])await apply(name,'dock');
 assert.deepEqual(errors,[]);
}finally{fs.writeFileSync(out+'/results.json',JSON.stringify({results,errors,realMedia:'NOT RUN',fixture:'Actual CallUi/MiniCallDock, synthetic canvas media, disconnected-from-server Room'},null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
