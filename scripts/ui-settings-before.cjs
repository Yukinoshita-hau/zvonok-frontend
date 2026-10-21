const { chromium } = require('C:/Users/Пользователь/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
(async () => {
  const out = 'artifacts/stages/ui-redesign-stage4-evidence'; fs.mkdirSync(out, {recursive:true});
  const account = {name:'stage4_'+Date.now(),password:require('node:crypto').randomUUID()+'aA1!'};
  fs.writeFileSync(path.join(os.tmpdir(),'zvonok-stage4-account.json'),JSON.stringify(account));
  const browser = await chromium.launch({headless:true});
  try {
    const page = await browser.newPage({viewport:{width:1366,height:768}});
    page.setDefaultTimeout(20000);
    await page.goto('http://localhost:3001/auth/register');
    await page.locator('[name=username]').fill(account.name);
    await page.locator('[name=email]').fill(account.name+'@test.invalid');
    await page.locator('[name=password]').fill(account.password);
    await page.locator('form button').click();
    await page.getByRole('button', {name:'Настройки пользователя',exact:true}).waitFor();
    await page.screenshot({path:out+'/before-shell.png'});
    await page.getByTitle('Мой профиль', {exact:true}).click();
    await page.screenshot({path:out+'/before-profile.png'});
    await page.getByRole('button', {name:'Закрыть',exact:true}).click();
    await page.getByRole('button', {name:'Настройки пользователя',exact:true}).click();
    await page.screenshot({path:out+'/before-settings.png'});
    await page.getByRole('button', {name:'Внешний вид',exact:true}).click();
    await page.screenshot({path:out+'/before-themes.png'});
    await page.goto('http://localhost:3001/notifications');
    await page.screenshot({path:out+'/before-notifications.png'});
    console.log('Baseline screenshots captured from Stage 3 Vite source');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1});
