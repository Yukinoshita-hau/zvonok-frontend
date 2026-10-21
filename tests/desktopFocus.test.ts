import { afterEach, describe, expect, it, vi } from 'vitest';
afterEach(()=>{vi.unstubAllGlobals();vi.resetModules();});
describe('native window focus for notification consumers',()=>{
  it('uses actual window visibility even when the renderer reports focused',async()=>{
    vi.resetModules();let changed!:(state:any)=>void;
    vi.stubGlobal('document',{hasFocus:()=>true});
    vi.stubGlobal('window',{zvonokDesktop:{lifecycle:{getWindowState:async()=>({focused:true,visible:false,minimized:false}),onWindowState:(callback:any)=>{changed=callback;return ()=>{};}}}});
    const {isAppFocused}=await import('../src/services/desktop.service');await Promise.resolve();
    expect(isAppFocused()).toBe(false);changed({focused:true,visible:true,minimized:false});expect(isAppFocused()).toBe(true);
    changed({focused:true,visible:true,minimized:true});expect(isAppFocused()).toBe(false);
  });
  it('does not let late initial IPC overwrite a newer hide event',async()=>{
    vi.resetModules();let changed!:(state:any)=>void,resolve!:(state:any)=>void;
    vi.stubGlobal('window',{zvonokDesktop:{lifecycle:{getWindowState:()=>new Promise(done=>{resolve=done;}),onWindowState:(callback:any)=>{changed=callback;return ()=>{};}}}});
    const {isAppFocused}=await import('../src/services/desktop.service');changed({focused:false,visible:false,minimized:false});
    resolve({focused:true,visible:true,minimized:false});await Promise.resolve();expect(isAppFocused()).toBe(false);
  });
});
