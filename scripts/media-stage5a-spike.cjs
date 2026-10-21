const {chromium}=require('C:/Users/Пользователь/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage();page.setDefaultTimeout(8000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const cdp=await page.context().newCDPSession(page);const memory=[];
 const sample=async cycle=>{await cdp.send('HeapProfiler.collectGarbage');memory.push({cycle,...await cdp.send('Runtime.getHeapUsage'),...await cdp.send('Memory.getDOMCounters')});};
 try{
 await page.goto('http://localhost:3001/scripts/media-stage5a-spike.html');
 await page.getByRole('button',{name:'Toggle'}).click();
 await page.waitForFunction(()=>document.querySelector('video')?.currentTime>0,{},{timeout:10000});
 assert.equal(await page.locator('video').count(),1);
 await page.screenshot({path:'artifacts/stages/media-stage5a-evidence/spike.png'});
 for(let i=0;i<20;i++){
 await page.getByRole('button',{name:'Toggle'}).click();assert.equal(await page.locator('video').count(),0);
 if([0,9,19].includes(i))await sample(i+1);
 await page.getByRole('button',{name:'Toggle'}).click();await page.waitForFunction(()=>document.querySelector('video')?.readyState>=2);
 }
 assert.ok(memory[2].usedSize-memory[0].usedSize<3*1024*1024,'JS retained heap grows across mount cycles');
 assert.ok(memory[2].jsEventListeners<=memory[0].jsEventListeners+5,'stale listeners');
 fs.writeFileSync('artifacts/stages/media-stage5a-evidence/spike.json',JSON.stringify({status:'PASS',strictMode:true,cycles:20,errors,memory},null,2));
 }catch(e){await page.screenshot({path:'artifacts/stages/media-stage5a-evidence/spike-failure.png'});fs.writeFileSync('artifacts/stages/media-stage5a-evidence/spike.json',JSON.stringify({status:'FAIL',error:e.message,errors,media:await page.locator('video').evaluateAll(nodes=>nodes.map(v=>({src:v.getAttribute('src'),state:v.readyState,error:v.error?.code,paused:v.paused})))},null,2));process.exitCode=1;}
 finally{await browser.close();}
})();
