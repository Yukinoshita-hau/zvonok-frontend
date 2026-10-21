import { describe, expect, it } from "vitest";
import { initialSpeakerState, selectSpeaker, type SpeakerInput } from "../src/components/CallUi/speakerSelection";

const person = (identity: string, speaking = false, microphoneEnabled = true): SpeakerInput =>
  ({ identity, speaking, microphoneEnabled, connected: true, cameraAvailable: true, audioLevel: 0.5 });

describe("Stage D synthetic speech timelines (monotonic ms)", () => {
  const start = () => selectSpeaker(initialSpeakerState(), [person("a"), person("b")], 0, "a", null, true);
  it("requires activation, silence hold and minimum dwell", () => {
    let s = start();
    s = selectSpeaker(s, [person("a"), person("b", true)], 100, "a", null, true);
    expect(s.candidate).toBe("b"); expect(s.selected).toBe("a"); expect(s.nextAt).toBe(2200);
    expect(s.automaticSwitchAllowed).toBe(false);
    s = selectSpeaker(s, [person("a"), person("b", true)], 2199, "a", null, true);
    expect(s.selected).toBe("a");
    s = selectSpeaker(s, [person("a"), person("b", true)], 2200, "a", null, true);
    expect(s.selected).toBe("b"); expect(s.reason).toBe("stable-speaker");
    expect(s.automaticSwitchAllowed).toBe(true);
  });
  it("coughs and short words never steal focus; silence never cycles", () => {
    let s = start();
    s = selectSpeaker(s, [person("a"), person("b", true)], 2500, "a", null, true);
    s = selectSpeaker(s, [person("a"), person("b")], 2800, "a", null, true);
    expect(s.candidate).toBeNull(); expect(s.nextAt).toBeNull();
    expect(selectSpeaker(s, [person("a"), person("b")], 9000, "a", null, true).selected).toBe("a");
  });
  it("activation is 500ms after an already silent incumbent", () => {
    let s = selectSpeaker(start(), [person("a"), person("b", true)], 3000, "a", null, true);
    expect(selectSpeaker(s, [person("a"), person("b", true)], 3499, "a", null, true).selected).toBe("a");
    s = selectSpeaker(s, [person("a"), person("b", true)], 3500, "a", null, true);
    expect(s.selected).toBe("b");
  });
  it("retains an incumbent during overlap and short silence", () => {
    let s = selectSpeaker(start(), [person("a", true), person("b", true)], 3000, "a", null, true);
    expect(s.selected).toBe("a"); expect(s.nextAt).toBeNull();
    s = selectSpeaker(s, [person("a"), person("b", true)], 4000, "a", null, true);
    expect(s.nextAt).toBe(5200);
    expect(selectSpeaker(s, [person("a"), person("b", true)], 5199, "a", null, true).selected).toBe("a");
    expect(selectSpeaker(s, [person("a"), person("b", true)], 5200, "a", null, true).selected).toBe("b");
  });
  it("replaces interrupted candidates and breaks ties by identity, independent of grid order", () => {
    let s = selectSpeaker(start(), [person("a"), person("c", true), person("b", true)], 3000, "a", null, true);
    expect(s.candidate).toBe("b");
    s = selectSpeaker(s, [person("a"), person("c", true), person("b")], 3200, "a", null, true);
    expect(s.candidate).toBe("c"); expect(s.nextAt).toBe(3700);
  });
  it("manual pin immediately wins even without mic/camera; unpin restarts activation", () => {
    let s = selectSpeaker(start(), [person("a", true), { ...person("b", false, false), cameraAvailable: false }], 100, "a", "b", true);
    expect(s.selected).toBe("b"); expect(s.automaticSwitchAllowed).toBe(false);
    s = selectSpeaker(s, [person("a", true), person("b")], 200, "b", null, true);
    expect(s.selected).toBe("b"); expect(s.candidateSince).toBe(200);
  });
  it("ignores muted/disconnected candidates and permits avatar speakers", () => {
    let s = selectSpeaker(start(), [person("a"), person("b", true, false)], 3000, "a", null, true);
    expect(s.candidate).toBeNull();
    s = selectSpeaker(s, [person("a"), { ...person("b", true), connected: false }], 3100, "a", null, true);
    expect(s.candidate).toBeNull();
    s = selectSpeaker(s, [person("a"), { ...person("b", true), cameraAvailable: false }], 4000, "a", null, true);
    expect(selectSpeaker(s, [person("a"), { ...person("b", true), cameraAvailable: false }], 4500, "a", null, true).selected).toBe("b");
  });
  it("clears pending candidate on mute and falls back on permanent departure", () => {
    let s = selectSpeaker(start(), [person("a"), person("b", true)], 3000, "a", null, true);
    s = selectSpeaker(s, [person("a"), person("b", true, false)], 3300, "a", null, true);
    expect(s.nextAt).toBeNull();
    expect(selectSpeaker(s, [person("b")], 3400, "a", "a", true).selected).toBe("b");
    expect(selectSpeaker(s, [], 3500, "a", null, true).selected).toBeNull();
  });
  it("Follow OFF retains displayed person and never schedules work; reset forgets prior call", () => {
    const s = selectSpeaker(start(), [person("a"), person("b", true)], 5000, "a", null, false);
    expect(s.selected).toBe("a"); expect(s.nextAt).toBeNull();
    expect(initialSpeakerState().selected).toBeNull();
  });
});
