import callReducer, { callActions } from "../src/store/slices/call.slice";
import { describe, expect, it } from "vitest";
import type { ShortMessage } from "../src/entities/shortMessage";
import {
  isMessageContinuation,
  shouldSubmitMessage,
} from "../src/components/DmItemsList/messagePresentation";
import {
  anchoredScroll,
  layoutRows,
} from "../src/components/DmItemsList/virtualLayout";
const message = (
  id: number,
  patch: Partial<ShortMessage> = {},
): ShortMessage => ({
  id,
  senderId: 1,
  room: { id: 1, type: "PRIVATE" },
  sentAt: "2026-10-19T10:00:00",
  content: "text",
  type: "DEFAULT",
  eventType: "MESSAGE",
  editedAt: null,
  replyPreview: null,
  replyToMessageId: null,
  attachments: [],
  ...patch,
});
describe("message presentation", () => {
  it("groups same author up to five minutes, including edits", () => {
    expect(
      isMessageContinuation(
        message(1),
        message(2, {
          sentAt: "2026-10-19T10:05:00",
          eventType: "MESSAGE_EDIT",
        }),
      ),
    ).toBe(true);
    expect(
      isMessageContinuation(
        message(1),
        message(2, { sentAt: "2026-10-19T10:05:01" }),
      ),
    ).toBe(false);
  });
  it("breaks on dates, authors, rooms, unread, replies, deletes and invalid time", () => {
    for (const patch of [
      { senderId: 2 },
      { type: "SYSTEM" as const },
      { type: "JOIN" as const },
      { sentAt: "2026-10-20T10:00:00" },
      { sentAt: "invalid" },
      { sentAt: "2026-10-19T09:59:59" },
      { replyToMessageId: 1 },
      { eventType: "MESSAGE_DELETE" as const },
      { room: { id: 2, type: "PRIVATE" as const } },
    ])
      expect(isMessageContinuation(message(1), message(2, patch))).toBe(false);
    expect(isMessageContinuation(null, message(2))).toBe(false);
    expect(
      isMessageContinuation(message(1, { type: "SYSTEM" }), message(2)),
    ).toBe(false);
    expect(isMessageContinuation(message(1), message(2), 2)).toBe(false);
    expect(
      isMessageContinuation(message(1, { replyToMessageId: 3 }), message(2)),
    ).toBe(false);
    expect(
      isMessageContinuation(
        message(1, { sentAt: "2026-10-18T23:59:00+03:00" }),
        message(2, { sentAt: "2026-10-19T00:00:00+03:00" }),
      ),
    ).toBe(false);
  });
  it("recomputes a page boundary after prepend with stable message anchors", () => {
    const loaded = [message(2), message(3)];
    expect(isMessageContinuation(null, loaded[0])).toBe(false);
    const merged = [message(1), ...loaded];
    expect(isMessageContinuation(merged[0], merged[1])).toBe(true);
    const before = layoutRows(
      ["2", "3"],
      new Map([
        ["2", 60],
        ["3", 24],
      ]),
      () => 60,
    );
    const after = layoutRows(
      ["1", "2", "3"],
      new Map([
        ["1", 60],
        ["2", 24],
        ["3", 24],
      ]),
      () => 60,
    );
    expect(anchoredScroll(before, after, 60)).toBe(84);
  });
  it("submits Enter only outside shift and IME for composer and editor", () => {
    const enter = { key: "Enter", shiftKey: false, isComposing: false };
    expect(shouldSubmitMessage(enter)).toBe(true);
    expect(shouldSubmitMessage({ ...enter, shiftKey: true })).toBe(false);
    expect(shouldSubmitMessage({ ...enter, isComposing: true })).toBe(false);
    expect(shouldSubmitMessage({ ...enter, keyCode: 229 })).toBe(false);
    expect(shouldSubmitMessage({ ...enter, key: "Escape" })).toBe(false);
  });
});

it("presentation retains the media session and microphone ownership", () => {
  const initial = callReducer(undefined, { type: "init" });
  const state = {
    ...initial,
    callId: 723,
    livekitRoomName: "media-room",
    mediaGeneration: 4,
    mediaOwnership: "OWNED" as const,
  };
  for (const mode of ["minimized", "expanded", "hidden"] as const) {
    const next = callReducer(state, callActions.setPresentationMode(mode));
    expect(next.presentationMode).toBe(mode);
    expect(next.callId).toBe(state.callId);
    expect(next.livekitRoomName).toBe(state.livekitRoomName);
    expect(next.mediaGeneration).toBe(state.mediaGeneration);
    expect(next.mediaOwnership).toBe(state.mediaOwnership);
  }
});
