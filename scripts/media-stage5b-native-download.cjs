const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
(async()=>{
 const browser=await require('./media-stage5b-electron.cjs').launch({channel:'chrome',headless:true}),page=await browser.newPage(),state=JSON.parse(fs.readFileSync(path.join(os.tmpdir(),'zvonok-stage5b-runtime.json'))),results=[];
 let backendBodies=0;page.on('request',r=>{if(r.method()==='GET'&&/\/message-attachments\/\d+\/download/.test(r.url()))backendBodies++;});
 try{
 await page.goto('http://localhost:3001/auth/login');await page.locator('[name=usernameOrEmail]').fill(state.owner.name);await page.locator('[name=password]').fill(state.owner.password);await page.locator('form button').click();await page.getByRole('button',{name:'Друзья',exact:true}).first().waitFor();await page.goto('http://localhost:3001/dm?roomId='+state.room.id);
 await page.getByRole('textbox',{name:'Сообщение',exact:true}).waitFor();
 await page.locator('input[type=file]').setInputFiles(['document.docx','archive.zip'].map(name=>({name,mimeType:name.endsWith('.zip')?'application/zip':'application/vnd.openxmlformats-officedocument.wordprocessingml.document',buffer:fs.readFileSync('artifacts/stages/media-stage5b-evidence/fixtures/'+name)})));
 const sent=page.waitForResponse(r=>r.url().includes('/messages/attachments')&&r.request().method()==='POST');await page.getByRole('button',{name:'Отправить сообщение',exact:true}).click();assert.equal((await sent).status(),200);
 for(const name of ['document.docx','archive.zip']){
  const button=page.getByRole('button').filter({has:page.getByText(name,{exact:true})}).last();
  await button.click();const download=await browser.download(()=>page.getByRole('dialog').getByRole('button',{name:'Скачать оригинал',exact:true}).click());
  assert.deepEqual(fs.readFileSync(await download.path()),fs.readFileSync('artifacts/stages/media-stage5b-evidence/fixtures/'+name));assert.equal(download.suggestedFilename(),name);results.push({status:'PASS',scenario:'native direct original bytes '+name});await page.keyboard.press('Escape');
 }
 assert.equal(backendBodies,0);results.push({status:'PASS',scenario:'no backend binary body',backendBodies});
 }catch(e){results.push({status:'FAIL',error:e.message.replace(/https?:\/\/[^\s]+/g,'[URL]')});process.exitCode=1;}
 finally{fs.writeFileSync('artifacts/stages/media-stage5b-evidence/native-download.json',JSON.stringify({results},null,2));await browser.close();console.log(results);}
})().catch(e=>{console.error(e.message);process.exitCode=1;});

