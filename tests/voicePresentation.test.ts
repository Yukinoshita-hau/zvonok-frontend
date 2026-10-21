import { describe, it, expect } from "vitest";
import reducer, { initialState, callActions, restoreCallSession } from "../src/store/slices/call.slice";
import { resolveStageLayout } from "../src/components/CallUi/stageLayout";
import { clampDock } from "../src/components/ActiveCallOverlay/dockPosition";
import { stableCardOrder } from "../src/components/CallUi/adaptiveLayout";
const active = { ...initialState, status: "in_call" as const, callId: 7, chatRoomId: 1, livekitRoomName:"room", participantToken:"token", mediaGeneration:5, callStartedAtMs:1000 };
describe("Stage B presentation", () => {
  it("defaults connected voice DM/GROUP to compact once", () => {
    const compact = reducer(active, callActions.initializePresentation({hasVideo:false}));
    expect(compact.presentationMode).toBe("minimized"); expect(compact.layoutIntent).toBe("voice");
    expect(reducer(compact, callActions.initializePresentation({hasVideo:true}))).toEqual(compact);
  });
  it("preserves manual Voice selected before connection", () => {
    const voice = reducer(active,callActions.setLayoutIntent("voice"));
    expect(reducer(voice,callActions.initializePresentation({hasVideo:false})).presentationMode).toBe("expanded");
  });
  it("waits for successful connection and retains camera/screen initial expanded", () => {
    expect(reducer({...active,mediaState:"connecting"}, callActions.initializePresentation({hasVideo:false})).presentationInitialized).toBe(false);
    expect(reducer(active,callActions.initializePresentation({hasVideo:true})).presentationMode).toBe("expanded");
    expect(reducer({...active,conferenceCode:"conference"},callActions.initializePresentation({hasVideo:false})).presentationMode).toBe("expanded");
  });
  it("manual expanded voice and compact survive media events and reconnect", () => {
    let state = reducer(active,callActions.setLayoutIntent("voice"));
    state = reducer(state,callActions.setPresentationMode("expanded"));
    state = reducer(state,callActions.initializePresentation({hasVideo:true}));
    for (const mode of ["minimized","expanded"] as const) {
      state = reducer(state,callActions.setPresentationMode(mode));
      expect([state.callId,state.participantToken,state.mediaGeneration,state.callStartedAtMs,state.layoutIntent]).toEqual([7,"token",5,1000,"voice"]);
    }
    state = reducer(state,callActions.mediaConnectionChanged({roomName:"room",generation:5,status:"reconnecting"}));
    expect(state.callId).toBe(7); expect(state.layoutIntent).toBe("voice");
  });
  it("voice ignores video and screen sources, automatic detects voice", () => {
    expect(resolveStageLayout([],"auto",null,null).mode).toBe("voice");
    expect(resolveStageLayout([],"voice",null,null).focusedCard).toBeNull();
  });
  it("keeps participant slots across mute, speaking and camera changes", () => {
    expect(stableCardOrder([{id:"b",speaking:true},{id:"a",speaking:false}], ["a","b"]).map(c=>c.id)).toEqual(["a","b"]);
  });
  it("ends and clears temporary view intent and screen SID", () => {
    const ended = reducer({...active,layoutIntent:"voice",selectedScreenTrackSid:"old"},callActions.endCallLocally());
    expect(ended.callId).toBeNull(); expect(ended.selectedScreenTrackSid).toBeNull(); expect(ended.layoutIntent).toBe("auto");
  });
  it("restores compact intent through a disconnected session restore", () => {
    let state = reducer(active,callActions.initializePresentation({hasVideo:false}));
    state = {...state,mediaState:"disconnected"};
    state = reducer(state,restoreCallSession.pending("restore",undefined));
    state = reducer(state,restoreCallSession.fulfilled({callRestoreType:"ACTIVE_CALL",restorable:true,callId:7,chatRoomId:1,roomId:1,roomType:"GROUP",callStatus:null,hostUsername:null,participantStatus:null,liveKitRoomName:"room",serverUrl:"ws://fixture",participantToken:"token",expiresAt:null,startedAt:"2026-10-20T01:00:00Z"},"restore",undefined));
    expect(state.presentationMode).toBe("minimized"); expect(state.layoutIntent).toBe("voice");
  });
  it("starts the next call expanded until it connects, clearing transient intent", () => {
    const compact = reducer(active,callActions.initializePresentation({hasVideo:false}));
    const next = reducer(compact,callActions.startOutgoing({chatRoomId:2}));
    expect(next.presentationMode).toBe("expanded"); expect(next.presentationInitialized).toBe(false); expect(next.layoutIntent).toBe("auto");
  });
  it("clamps dock for resize/zoom and invalid storage", () => {
    for (const [w,h] of [[1920,1080],[1440,900],[1366,768],[1024,768],[1024,600],[1000,700]]) {
      const p = clampDock(9999,9999,280,220,w,h); expect(p.x+280).toBeLessThanOrEqual(w-8); expect(p.y+220).toBeLessThanOrEqual(h-8);
    }
    expect(clampDock(NaN,-20,280,220,1024,600)).toEqual({x:8,y:8});
  });
});
