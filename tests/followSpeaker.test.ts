import { afterEach, describe, expect, it, vi } from "vitest";
import { ConnectionState, RoomEvent, type Room } from "livekit-client";
import { EventEmitter } from "node:events";
import { observeFollowSpeaker, participantSpeaking } from "../src/components/CallUi/hooks/useFollowSpeaker";
import { initialSpeakerState } from "../src/components/CallUi/speakerSelection";
import reducer, { callActions, initialState } from "../src/store/slices/call.slice";
import { resolveStageLayout } from "../src/components/CallUi/stageLayout";
import { resolveContentSources, type MediaSourcePresentation } from "../src/components/CallUi/sourcePresentation";
import type { ParticipantCard } from "../src/components/CallUi/hooks/useCallParticipants";

afterEach(() => vi.useRealTimers());
describe("Stage D observer lifecycle and manual priorities", () => {
  it("owns at most one deadline, cancels on unmount and removes Room listeners", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
    const a = { identity: "a", isSpeaking: false, isMicrophoneEnabled: true, isCameraEnabled: false, audioLevel: 0, getTrackPublication: () => undefined };
    const b = { ...a, identity: "b", isSpeaking: true };
    const room = Object.assign(new EventEmitter(), { state: ConnectionState.Connected, localParticipant: a, remoteParticipants: new Map([["b", b]]) });
    const commit = vi.fn();
    const stop = observeFollowSpeaker(room as unknown as Room, { current: initialSpeakerState() }, { follow: true, pin: null, focus: "a", threshold: .3 }, commit);
    for (let i = 0; i < 30; i++) room.emit(RoomEvent.ActiveSpeakersChanged, [b]);
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(2200); expect(commit).toHaveBeenLastCalledWith("b");
    b.isSpeaking = false; a.isSpeaking = true; room.emit(RoomEvent.ActiveSpeakersChanged, [a]);
    expect(vi.getTimerCount()).toBe(1);
    stop(); expect(vi.getTimerCount()).toBe(0); expect(room.eventNames()).toEqual([]);
    const count = commit.mock.calls.length;
    vi.advanceTimersByTime(9000); expect(commit).toHaveBeenCalledTimes(count);
  });
  it("freezes selected/pending work through reconnect and resumes with fresh activation", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
    const a = { identity: "a", isSpeaking: false, isMicrophoneEnabled: true, isCameraEnabled: false, audioLevel: 0, getTrackPublication: () => undefined };
    const b = { ...a, identity: "b", isSpeaking: true };
    const room = Object.assign(new EventEmitter(), { state: ConnectionState.Connected, localParticipant: a, remoteParticipants: new Map([["b", b]]) });
    const state = { current: initialSpeakerState() }, commit = vi.fn();
    const stop = observeFollowSpeaker(room as unknown as Room, state, { follow: true, pin: "b", focus: "a", threshold: .3 }, commit);
    room.state = ConnectionState.Reconnecting; room.remoteParticipants.clear(); room.emit(RoomEvent.ConnectionStateChanged);
    vi.advanceTimersByTime(9000); expect(state.current.selected).toBe("b"); expect(vi.getTimerCount()).toBe(0);
    stop();
  });
  it("uses SDK microphone state and existing local sensitivity, never screen audio", () => {
    const p = { isLocal: true, isMicrophoneEnabled: true, isSpeaking: true, audioLevel: .2 } as Room["localParticipant"];
    expect(participantSpeaking(p, .3)).toBe(false);
    expect(participantSpeaking({ ...p, audioLevel: .4 } as typeof p, .3)).toBe(true);
    expect(participantSpeaking({ ...p, isLocal: false, isMicrophoneEnabled: false } as typeof p, .3)).toBe(false);
  });
  it("screen audio cannot nominate its owner even with a live microphone", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
    const a = { identity: "a", isSpeaking: false, isMicrophoneEnabled: true, audioLevel: 0, getTrackPublication: () => undefined };
    const b = { ...a, identity: "b", isSpeaking: true, getTrackPublication: () => ({ isMuted: false }) };
    const room = Object.assign(new EventEmitter(), { state: ConnectionState.Connected, localParticipant: a, remoteParticipants: new Map([["b", b]]) });
    const state = { current: initialSpeakerState() };
    const stop = observeFollowSpeaker(room as unknown as Room, state, { follow: true, pin: null, focus: "a", threshold: .3 }, vi.fn());
    vi.advanceTimersByTime(9000); expect(state.current.selected).toBe("a"); expect(state.current.candidate).toBeNull(); stop();
  });
  it("Follow and person pin never change layout, Compact, sources or media identity", () => {
    for (const layoutIntent of ["auto", "voice", "grid", "focus", "screen"] as const) {
      let s = { ...initialState, callId: 8, layoutIntent, presentationMode: "minimized" as const,
        content: { ...initialState.content, primaryKey: "screen:one", secondaryKey: "camera:two", split: true, sourceManual: true } };
      const before = { ...s };
      s = reducer(s, callActions.setFollowSpeaker(true)) as typeof s;
      s = reducer(s, callActions.setPinnedParticipant("a")) as typeof s;
      expect(s.pinnedParticipant).toBe("a");
      expect({ ...s, followSpeaker: false, pinnedParticipant: null }).toEqual(before);
      s = reducer(s, callActions.setFollowSpeaker(true)) as typeof s;
      expect(s.pinnedParticipant).toBeNull();
      s = reducer(s, callActions.endCallLocally()) as typeof s;
      expect(s.followSpeaker).toBe(false); expect(s.pinnedParticipant).toBeNull();
    }
  });
  it("Focus target cannot steal Content primary/Split secondary or reorder Grid", () => {
    const cards = [{ id: "a" }, { id: "b" }, { id: "screen:one", isScreenShareCard: true, videoTrack: { publication: { trackSid: "one" } } }] as ParticipantCard[];
    const sources = [{ key: "screen:one", type: "screen" }, { key: "camera:two", type: "camera" }] as MediaSourcePresentation[];
    for (const target of ["a", "b", null]) {
      expect(resolveStageLayout(cards, "grid", target, "one").stripCards).toEqual(cards);
      expect(resolveStageLayout(cards, "auto", target, "one").mode).toBe("screen");
      expect(resolveContentSources(sources, "screen:one", "camera:two")).toEqual({ primary: sources[0], secondary: sources[1] });
    }
  });
});
