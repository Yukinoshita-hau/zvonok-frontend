const {chromium}=require('C:/Users/Пользователь/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
(async()=>{const s=JSON.parse(fs.readFileSync(path.join(os.tmpdir(),'zvonok-stage5c-runtime.json'))),result={status:'FAIL'},api='http://127.0.0.1:18081/api',headers={Authorization:'Bearer '+s.owner.accessToken};let browser;
 try {
  const form=new FormData();form.set('clientRequestId',crypto.randomUUID());form.set('attachmentType','VIDEO_NOTE');form.set('durationMs','2000');form.set('files',new Blob([fs.readFileSync('artifacts/stages/media-stage5a-evidence/clip.webm')],{type:'video/webm'}),'stage5c-historical-note.webm');
  const upload=await fetch(api+`/rooms/${s.libraryRoom.id}/messages/attachments`,{method:'POST',headers,body:form});assert.equal(upload.status,200);
  browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1366,height:768}});page.setDefaultTimeout(60000);
  await page.goto('http://localhost:3001/auth/login');await page.locator('[name=usernameOrEmail]').fill(s.owner.name);await page.locator('[name=password]').fill(s.owner.password);await page.locator('form button').click();await page.getByRole('button',{name:'Друзья',exact:true}).first().waitFor();
  await page.goto('http://localhost:3001/dm?roomId='+s.libraryRoom.id);await page.getByRole('button',{name:'Медиа и файлы',exact:true}).click();const library=page.getByRole('dialog',{name:'Медиа и файлы',exact:true});
  for(const [category,name,element] of [['Аудио','stage5c-audio.mp3','audio'],['Видео','stage5c-historical-note.webm','video']]){
    await library.getByRole('button',{name:category,exact:true}).click();await library.getByRole('button',{name:'Открыть '+name,exact:true}).click();
    const viewer=page.getByRole('dialog').filter({has:page.locator('button',{hasText:'Скачать оригинал'})});await viewer.getByRole('button',{name:/Воспроизвести/}).click();
    await page.waitForFunction(element=>document.querySelector('[role=dialog] '+element)?.currentTime>0,element);await page.screenshot({path:'artifacts/stages/media-stage5c-evidence/browser/legacy-'+element+'.png'});await page.keyboard.press('Escape');
  }
  assert.equal(await page.getByRole('button',{name:/Записать голосовое|Записать видео/}).count(),0);Object.assign(result,{status:'PASS',audioPlayback:true,videoNotePlayback:true,recordingUiAbsent:true});
 }catch(e){result.error=e.message;process.exitCode=1;}finally{fs.writeFileSync('artifacts/stages/media-stage5c-evidence/legacy-results.json',JSON.stringify(result,null,2));console.log(result);await browser?.close();}})();
