import { describe, expect, it } from "vitest";
import reducer, { callActions, initialState } from "../src/store/slices/call.slice";

describe("Stage C call-scoped intent", () => {
  const active = { ...initialState, status: "in_call" as const, callId: 7, livekitRoomName: "room", participantToken: "token", callStartedAtMs: 1000, mediaGeneration: 3 };
  it("retains Content/Split through Compact, navigation presentation and Expanded without media identity changes", () => {
    let state = reducer(active, callActions.setLayoutIntent("screen"));
    state = reducer(state, callActions.setContentPresentation({ primaryKey: "screen:one", secondaryKey: '["alice","camera"]', split: true, ratio: 70 }));
    const content = state.content;
    for (const action of [callActions.setPresentationMode("minimized"), callActions.setPresentationMode("expanded"), callActions.setTheaterMode(true), callActions.setTheaterMode(false)]) {
      state = reducer(state, action);
      expect(state.content).toEqual(content);
      expect([state.callId,state.livekitRoomName,state.participantToken,state.mediaGeneration,state.callStartedAtMs]).toEqual([7,"room","token",3,1000]);
    }
  });
  it("clamps invalid ratios, rejects identical source selections and clears all transient content on end", () => {
    let state = reducer(active, callActions.setContentPresentation({ primaryKey: "screen:one", secondaryKey: "screen:one", split: true, ratio: 500 }));
    expect(state.content.ratio).toBe(70); expect(state.content.secondaryKey).toBeNull();
    state = reducer(state, callActions.setContentPresentation({ ratio: NaN }));
    expect(state.content.ratio).toBe(50);
    state = reducer(state, callActions.endCallLocally());
    expect(state.content).toEqual(initialState.content); expect(state.selectedScreenTrackSid).toBeNull();
  });
  it("media initialization never overwrites manual Grid/Voice/Content or expands Compact", () => {
    for (const layout of ["voice","grid","screen"] as const) {
      let state = reducer(active,callActions.setLayoutIntent(layout));
      state = reducer(state,callActions.setPresentationMode("minimized"));
      state = reducer(state,callActions.initializePresentation({hasVideo:true}));
      expect(state.layoutIntent).toBe(layout); expect(state.presentationMode).toBe("minimized");
    }
  });
});
