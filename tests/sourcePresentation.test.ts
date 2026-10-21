import { describe, it, expect } from "vitest";
import { createPresentation, resolveContentSources } from "../src/components/CallUi/sourcePresentation";
import type { ParticipantCard } from "../src/components/CallUi/hooks/useCallParticipants";
import type { TrackReference } from "@livekit/components-react";
const person = { identity: "alice", isMicrophoneEnabled: true, isSpeaking: false, isLocal: false };
const cards = [{ id: "alice", participant: person, displayName: "Alice", isScreenShareCard: false }] as ParticipantCard[];
const track = (sid: string, source = "camera", muted = false) => ({ participant: person, source,
  publication: { trackSid: sid, isMuted: muted, isSubscribed: true, dimensions: { width: 3440, height: 1440 }, track: { streamState: "active" } } }) as TrackReference;
describe("C.1 source presentation", () => {
  it("separates a person from camera and screen, deduplicating sources", () => {
    const model = createPresentation(cards, [track("cam"), track("share", "screen_share"), track("share", "screen_share")], false);
    expect(model.people).toHaveLength(1); expect(model.sources).toHaveLength(2);
    expect(model.sources.map(s => s.type)).toEqual(["camera", "screen"]);
    expect(model.sources[1].aspectRatio).toBe(3440 / 1440);
  });
  it("retains camera intent and screen SID on attached track replacement", () => {
    const before = createPresentation(cards, [track("cam"), track("share", "screen_share")], false).sources;
    const after = createPresentation(cards, [track("cam-new"), track("share", "screen_share")], false).sources;
    expect(after.map(s => s.key)).toEqual(before.map(s => s.key));
    expect(after[0].publicationSid).toBe("cam-new");
  });
  it("keeps paused/reconnecting publications selected without metadata timers", () => {
    const paused = createPresentation(cards, [track("share", "screen_share", true)], false).sources;
    expect(paused[0].availability).toBe("paused");
    expect(resolveContentSources(paused, paused[0].key, null).primary).toBe(paused[0]);
    expect(createPresentation(cards, [track("share", "screen_share")], true).sources[0].availability).toBe("reconnecting");
  });
  it("does not steal manual selection, excludes duplicate secondary, falls back to survivor", () => {
    const sources = createPresentation(cards, [track("cam"), track("one", "screen_share"), track("two", "screen_share")], false).sources;
    expect(resolveContentSources(sources, sources[1].key, sources[2].key).primary).toBe(sources[1]);
    expect(resolveContentSources(sources, sources[1].key, sources[1].key).secondary).toBeNull();
    expect(resolveContentSources(sources.slice(0, 1).concat(sources[2]), sources[1].key, sources[2].key).primary).toBe(sources[2]);
    expect(resolveContentSources([], "ended", null).primary).toBeNull();
    expect(sources[1].key).not.toBe(sources[2].key);
  });
});
