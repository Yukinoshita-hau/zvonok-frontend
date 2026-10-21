const {chromium}=require('C:/Users/Пользователь/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});try{
const page=await browser.newPage({viewport:{width:1366,height:768}});const base='http://localhost:3000';const out='artifacts/stages/ui-redesign-stage4-evidence/docker-runtime';fs.mkdirSync(out,{recursive:true});
await page.goto(base+'/auth/register');const name='stage4baseline'+Date.now();await page.locator('[name=username]').fill(name);await page.locator('[name=email]').fill(name+'@test.invalid');await page.locator('[name=password]').fill(require('node:crypto').randomUUID()+'aA1!');await page.locator('form button').click();
await page.getByRole('button',{name:'Настройки пользователя',exact:true}).waitFor();await page.getByRole('button',{name:'Уведомления',exact:true}).click();await page.waitForURL('**/notifications');await page.getByRole('heading').first().waitFor();await page.screenshot({path:out+'/notifications.png'});
await page.getByRole('button',{name:'Настройки пользователя',exact:true}).click();await page.getByRole('button',{name:'Голос и видео',exact:true}).click();await page.waitForTimeout(500);await page.screenshot({path:out+'/devices.png'});
fs.writeFileSync(out+'/runtime.json',JSON.stringify({base,html:await (await page.request.get(base)).text(),note:'Existing Docker bundle, not Stage 4 Vite source'},null,2));console.log('Docker runtime screenshots PASS');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});

