const {chromium}=require('C:/Users/Пользователь/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const out='artifacts/stages/work/settings-promotion/functional';fs.mkdirSync(out,{recursive:true});
(async()=>{
const browser=await chromium.launch({headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
const context=await browser.newContext({permissions:['microphone','camera'],viewport:{width:1440,height:900}}),page=await context.newPage();
await page.addInitScript(()=>{const gum=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=async c=>{try{return await gum(c)}catch(e){window.gumError={constraint:e.constraint,name:e.name,requested:c};throw e}}});const results=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
const check=async(name,fn)=>{try{await fn();results.push({name,status:'PASS'});console.log('PASS',name)}catch(e){results.push({name,status:'FAIL',error:e.message});throw e}};
const category=name=>page.getByRole('navigation',{name:'Разделы настроек',exact:true}).getByRole('button',{name,exact:true}).click();
const tab=name=>page.getByRole('tab',{name,exact:true}).click();
const state=()=>page.evaluate(()=>window.settingsFixture.view().device);
const field=id=>page.locator('#setting-'+id);
try{
await page.goto('http://127.0.0.1:5199/dm?roomId=42&functional');
await page.getByRole('button',{name:'Настройки пользователя',exact:true}).click();
await check('media selection before call persists preference without capture',async()=>{
 await category('Голос и видео');await page.getByRole('combobox',{name:'Микрофон',exact:true}).selectOption({index:1});assert.notEqual((await state()).selectedMicrophoneId,'default');
 assert.equal(await page.getByRole('button',{name:'Закончить прослушивание',exact:true}).count(),0);
});
await check('supported synthetic audio output confirms before saving',async()=>{await tab('Наушники');const output=page.getByRole('combobox',{name:'Устройство вывода',exact:true});if(await output.count()){await output.selectOption({index:1});await page.waitForFunction(()=>!window.settingsFixture.view().device.deviceSwitchPending);assert.notEqual((await state()).selectedAudioOutputId,'default');}else await page.getByText(/Выбор аудиовыхода не поддерживается/).waitFor();});await check('EC AGC and custom controls share existing state',async()=>{
 await tab('Микрофон');
 await page.getByLabel('Эхоподавление',{exact:true}).check();await page.getByLabel('Автоматическая регулировка усиления (AGC)',{exact:true}).check();
 await tab('Обработка');await page.getByLabel('Пресет голоса',{exact:true}).selectOption('custom');
 await page.getByLabel('Громкость микрофона',{exact:true}).fill('145');assert.equal((await state()).voiceProcessingConfig.inputVolume,1.45);assert.equal((await state()).voiceProcessingPreset,'custom');
});
await check('screen preference matches picker default and confirm result',async()=>{
 await tab('Экран');
 await field('screen').locator('select').selectOption('mediumPlus');
 await page.getByRole('button',{name:'Закрыть настройки',exact:true}).click();await page.getByTestId('functional-picker').click();
 assert.match(await page.locator('[data-selected="true"][class*="quality-card"]').innerText(),/Среднее\+/i);
 await page.getByRole('button',{name:'Начать показ',exact:true}).click();
 assert.equal(await page.evaluate(()=>window.functionalPickerResult.quality.value),'mediumPlus');
});
await page.getByRole('button',{name:'Настройки пользователя',exact:true}).click();
await check('notification toggles local persistence and browser permission state',async()=>{
 await category('Уведомления');await page.getByLabel('Разрешить звуки уведомлений',{exact:true}).uncheck();await page.getByLabel('Системные уведомления',{exact:true}).uncheck();
 assert.equal((await state()).notificationSoundsEnabled,false);assert.equal((await state()).desktopNotificationsEnabled,false);
 await page.screenshot({path:out+'/notifications-1440.png'});
});
await check('hotkey conflict reserved key custom assignment and reset',async()=>{
 await category('Горячие клавиши');const camera=page.getByLabel('Горячая клавиша: Камера',{exact:true});
 await camera.click();await page.keyboard.press('Control+Alt+M');await page.getByText('Комбинация уже назначена другой команде.',{exact:true}).waitFor();assert.equal((await state()).toggleCameraHotkey.code,'KeyV');
 await page.keyboard.press('Control+W');await page.getByText(/Эта комбинация зарезервирована/).waitFor();
 await page.keyboard.press('Control+Alt+Q');assert.equal((await state()).toggleCameraHotkey.code,'KeyQ');
 await page.screenshot({path:out+'/hotkeys-1440.png'});
});
await check('application explains unsupported desktop contracts',async()=>{await category('Приложение');await page.getByText('Обновления доступны в приложении Zvonok для Windows.',{exact:true}).waitFor();await page.screenshot({path:out+'/application-1440.png'});});
await check('reload restores validated preferences',async()=>{
 await page.reload();await category('Голос и видео');const s=await state();assert(s.isEchoCancellationEnabled&&s.isAutoGainControlEnabled);assert.equal(s.voiceProcessingConfig.inputVolume,1.45);assert.equal(s.screenShareQuality,'mediumPlus');assert.equal(s.notificationSoundsEnabled,false);assert.equal(s.toggleCameraHotkey.code,'KeyQ');
});
await check('Legacy and V2 share device processing and hotkey values',async()=>{
 await page.getByRole('button',{name:'Закрыть настройки',exact:true}).click();await page.evaluate(()=>localStorage.setItem('zvonok.settingsUI','legacy'));await page.getByRole('button',{name:'Настройки пользователя',exact:true}).click();const d=page.getByRole('dialog',{name:'Настройки пользователя'});
 await d.getByRole('button',{name:'Голос и видео',exact:true}).click();assert.equal(await d.getByRole('checkbox',{name:'Эхоподавление',exact:true}).isChecked(),true);
 await d.getByRole('checkbox',{name:'Эхоподавление',exact:true}).uncheck();await page.getByRole('button',{name:'Закрыть настройки',exact:true}).click();await page.evaluate(()=>localStorage.removeItem('zvonok.settingsUI'));await page.getByRole('button',{name:'Настройки пользователя',exact:true}).click();assert.equal(await page.getByLabel('Эхоподавление',{exact:true}).isChecked(),false);
});
await check('synthetic microphone preview level and cleanup on subtab switch',async()=>{await page.getByRole('combobox',{name:'Микрофон',exact:true}).selectOption('default');
 await page.getByRole('button',{name:'Послушать себя',exact:true}).click();await page.waitForFunction(()=>document.querySelector('audio')?.srcObject || document.querySelector('[role=alert]'));console.log('PREVIEW',await page.getByRole('alert').allTextContents(),await page.evaluate(()=>window.gumError));
 await page.waitForFunction(()=>document.querySelector('audio')?.srcObject?.getAudioTracks().length>0);
 await page.waitForFunction(()=>Number(document.querySelector('[role=meter]').getAttribute('aria-valuenow'))>0);await page.evaluate(()=>{window.previewTracks=[...document.querySelector('audio').srcObject.getTracks()]});
 await tab('Обработка');await page.waitForFunction(()=>window.previewTracks.every(t=>t.readyState==='ended'));await page.getByRole('checkbox',{name:'RNNoise',exact:true}).check();assert((await state()).voiceProcessingConfig.rnnoise.enabled);
 await page.getByRole('button',{name:'Закрыть настройки',exact:true}).click();
});
await check('synthetic camera preview cleanup',async()=>{
 await page.getByRole('button',{name:'Настройки пользователя',exact:true}).click();await category('Голос и видео');await tab('Камера');await page.getByRole('button',{name:'Проверить камеру',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#setting-camera video')?.srcObject?.getVideoTracks().length>0);
 await page.evaluate(()=>window.cameraTracks=[...document.querySelector('#setting-camera video').srcObject.getTracks()]);await category('Приложение');await page.waitForFunction(()=>window.cameraTracks.every(t=>t.readyState==='ended'));
});
await check('active call switching success failure and preview prohibition are component fixture only',async()=>{
 await page.getByRole('button',{name:'Закрыть настройки',exact:true}).click();await page.getByLabel('Модель звонка').selectOption('compact');await page.getByRole('button',{name:'Настройки пользователя',exact:true}).click();await category('Голос и видео');
 assert(await page.getByRole('button',{name:'Послушать себя',exact:true}).isDisabled());await tab('Камера');assert(await page.getByRole('button',{name:'Проверить камеру',exact:true}).isDisabled());await tab('Микрофон');
 await page.getByRole('combobox',{name:'Микрофон',exact:true}).selectOption('default');await page.waitForFunction(()=>!window.settingsFixture.view().device.deviceSwitchPending);assert.equal((await state()).selectedMicrophoneId,'default');
 await page.evaluate(()=>window.functionalMedia.fail=true);await page.getByRole('combobox',{name:'Микрофон',exact:true}).selectOption({index:1});await page.waitForFunction(()=>!window.settingsFixture.view().device.deviceSwitchPending);
 assert.equal((await state()).selectedMicrophoneId,'default');assert.match((await state()).mediaError,/не подтверждено/);await page.evaluate(()=>window.functionalMedia.fail=false);
 await tab('Камера');await page.getByRole('combobox',{name:'Камера',exact:true}).selectOption({index:1});await page.waitForFunction(()=>!window.settingsFixture.view().device.deviceSwitchPending);assert.notEqual((await state()).selectedCameraId,'default');
 await page.screenshot({path:out+'/media-active-fixture.png'});
});
await check('focused hotkey handles command outside input and skips text and settings',async()=>{
 await page.keyboard.press('Control+Alt+Q');assert.equal(await page.evaluate(()=>window.functionalMedia.cameraToggles),0);
 await page.getByRole('button',{name:'Закрыть настройки',exact:true}).click();await page.locator('[data-mount] textarea').focus();await page.keyboard.press('Control+Alt+Q');assert.equal(await page.evaluate(()=>window.functionalMedia.cameraToggles),0);
 await page.getByTestId('functional-picker').focus();await page.keyboard.press('Control+Alt+Q');await page.waitForFunction(()=>window.functionalMedia.cameraToggles===1);
});
await check('storage write denial is visible and does not reset session preference',async()=>{
 await page.getByRole('button',{name:'Настройки пользователя',exact:true}).click();await category('Уведомления');await page.evaluate(()=>Storage.prototype.setItem=function(){throw new Error('denied')});
 await page.getByLabel('Разрешить звуки уведомлений',{exact:true}).check();await page.getByText(/Настройки действуют в этой сессии, но не сохранены/).waitFor();assert.equal((await state()).notificationSoundsEnabled,true);
});
await check('responsive media panels have no horizontal overflow',async()=>{
 await category('Голос и видео');for(const width of [1440,1024,800]){await page.setViewportSize({width,height:900});await page.screenshot({path:out+`/media-${width}.png`});assert(await page.locator('#zvonok-settings-content').evaluate(e=>e.scrollWidth<=e.clientWidth));}
});
assert.deepEqual(errors,[]);
}catch(e){console.log('ALERTS',await page.getByRole('alert').allTextContents());await page.screenshot({path:out+'/failure.png'});console.error(e);process.exitCode=1;}
finally{fs.writeFileSync(out+'/results.json',JSON.stringify({results,errors},null,2));await browser.close();}
})();









