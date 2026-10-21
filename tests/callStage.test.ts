import { describe, it, expect } from "vitest";
import { resolveStageLayout } from "../src/components/CallUi/stageLayout";
import type { ParticipantCard } from "../src/components/CallUi/hooks/useCallParticipants";
import reducer, {
  callActions,
  getCallToken,
} from "../src/store/slices/call.slice";

const card = (id: string, screen = false) =>
  ({
    id,
    isScreenShareCard: screen,
    videoTrack: screen ? { publication: { trackSid: id } } : undefined,
  }) as ParticipantCard;
const cards = [
  card("alice"),
  card("bob"),
  card("share", true),
  card("other", true),
];
describe("call stage presentation", () => {
  it("automatically promotes a screen and excludes its duplicate tile", () => {
    const stage = resolveStageLayout(cards, "auto", null, "share");
    expect(stage.mode).toBe("screen");
    expect(stage.focusedCard?.id).toBe("share");
    expect(stage.stripCards.map((c) => c.id)).toEqual([
      "alice",
      "bob",
      "other",
    ]);
  });
  it("keeps explicit grid while screens are published", () =>
    expect(
      resolveStageLayout(cards, "grid", "share", "share").focusedCard,
    ).toBeNull());
  it("pins a screen while a different screen is selected", () =>
    expect(
      resolveStageLayout(cards, "screen", "share", "other").focusedCard?.id,
    ).toBe("share"));
  it("focuses voice-only participants", () =>
    expect(
      resolveStageLayout(cards, "focus", "bob", null).focusedCard?.id,
    ).toBe("bob"));
  it("falls back after a pinned participant leaves", () =>
    expect(
      resolveStageLayout(cards, "focus", "gone", null).focusedCard?.id,
    ).toBe("alice"));
  it("returns to grid after the last screen ends", () =>
    expect(
      resolveStageLayout(cards.slice(0, 2), "screen", "share", "share").mode,
    ).toBe("grid"));
  it("handles empty and single participant rooms", () => {
    expect(resolveStageLayout([], "focus", null, null).focusedCard).toBeNull();
    expect(
      resolveStageLayout([cards[0]], "auto", null, null).stripCards,
    ).toHaveLength(1);
  });
  it("keeps media identity across all presentation actions", () => {
    let state = reducer(
      undefined,
      callActions.prepareJoinedCall({
        callId: 91,
        chatRoomId: 7,
        roomType: "GROUP",
        livekitRoomName: "group-7-call-91",
        callerUsername: "alice",
        hostUsername: "alice",
      }),
    );
    state = reducer(state, getCallToken.pending("token", 91));
    state = reducer(
      state,
      getCallToken.fulfilled(
        {
          callId: 91,
          participantToken: "media",
          serverUrl: "ws://media",
          mediaOwnership: "OWNED",
        },
        "token",
        91,
      ),
    );
    const identity = (s: typeof state) => [
      s.callId,
      s.livekitRoomName,
      s.mediaGeneration,
      s.participantToken,
      s.mediaOwnership,
    ];
    const initial = identity(state);
    for (const action of [
      callActions.setPresentationMode("minimized"),
      callActions.setPresentationMode("expanded"),
      callActions.setCallFocusMode(true),
      callActions.setTheaterMode(true),
      callActions.setSelectedScreenTrackSid("share"),
      callActions.setTheaterMode(false),
    ]) {
      state = reducer(state, action);
      expect(identity(state)).toEqual(initial);
    }
    state = reducer(state, callActions.endCallLocally());
    expect(state.callId).toBeNull();
    expect(state.participantToken).toBeNull();
  });
});
