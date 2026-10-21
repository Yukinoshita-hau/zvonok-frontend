import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
const h = vi.hoisted(() => ({ enabled:false, pending:false, error:"", errorKind:null as string|null, index:0, writes:[] as unknown[][], setEnabled:vi.fn(async()=>undefined) }));
vi.mock("react", async original => ({...await original<typeof import("react")>(), useState:()=> {
  const index=h.index++; const values=[h.pending,h.error,h.errorKind];
  return [values[index], (value:unknown)=>h.writes.push([index,value])];
}}));
vi.mock("@livekit/components-react",()=>({useConnectionState:()=>"connected",useTrackToggle:()=>({enabled:h.enabled})}));
vi.mock("react-redux",()=>({useSelector:()=>"high"}));
vi.mock("../src/components/CallUi/useMicrophoneCaptureOptions",()=>({useMicrophoneCaptureOptions:()=>({})}));
vi.mock("../src/utils/microphoneQuality",()=>({getMicrophonePublishOptions:()=>({})}));
vi.mock("../src/components/CallUi/CallMicrophoneProvider",()=>({useCallMicrophoneOwner:()=>({setEnabled:h.setEnabled})}));
import { MicrophoneToggleButton } from "../src/components/CallUi/MicrophoneToggleButton";
const button=()=>MicrophoneToggleButton({className:"fixture",enabledLabel:"",disabledLabel:"",showIcon:true});
beforeEach(()=>{vi.stubGlobal("React",React);Object.assign(h,{enabled:false,pending:false,error:"",errorKind:null,index:0,writes:[]});h.setEnabled.mockReset();h.setEnabled.mockResolvedValue(undefined);});
afterEach(()=>vi.unstubAllGlobals());
describe("microphone presentation reflects actual media state",()=>{
  it.each([false,true])("describes the state and next action, enabled=%s", enabled=>{
    h.enabled=enabled;const b=button();expect(b.props["aria-pressed"]).toBe(enabled);
    expect(b.props["aria-label"]).toContain(enabled?"Выключить":"Включить");
    expect(b.props["data-mic-state"]).toBe(enabled?"enabled":"muted");
  });
  it("shows pending without changing actual enabled state",()=>{h.pending=true;const b=button();expect(b.props.disabled).toBe(true);expect(b.props["aria-busy"]).toBe(true);expect(b.props["aria-pressed"]).toBe(false);});
  it.each(["NotFoundError","NotAllowedError","NotReadableError","OperationError"])("reports failed operation %s without optimistic success",async name=>{
    const log=vi.spyOn(console,"error").mockImplementation(()=>{});
    h.setEnabled.mockRejectedValue(Object.assign(new Error("fixture"),{name}));const b=button();b.props.onClick();
    await new Promise(resolve=>setTimeout(resolve,0));
    expect(b.props["aria-pressed"]).toBe(false);expect(h.writes).toContainEqual([2,name==="OperationError"?"error":"unavailable"]);expect(h.writes).toContainEqual([0,false]);log.mockRestore();
  });
  it("keeps errors keyboard accessible and retryable",()=>{h.error="Микрофон недоступен";h.errorKind="unavailable";const b=button();expect(b.props.disabled).toBe(false);expect(b.props["aria-invalid"]).toBe(true);expect(b.props.title).toBe(h.error);});
});
