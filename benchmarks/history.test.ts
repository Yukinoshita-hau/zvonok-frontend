import { expect, it } from "vitest";
import reducer, {
  fetchRoomMessages,
  messageActions,
} from "../src/store/slices/message.slice";
import type { ShortMessage } from "../src/entities/shortMessage";

// Opt in separately; wall times are observations, never pass/fail thresholds.
for (const count of [1000, 5000, 10000])
  it(`retains and releases ${count} synthetic messages`, () => {
    const messages = Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      content: "synthetic " + i,
      type: "DEFAULT",
      eventType: "MESSAGE",
      sentAt: "2026-10-18T00:00:00",
      senderId: 2,
      room: { id: 1, type: "GROUP" },
      editedAt: null,
      replyToMessageId: null,
      replyPreview: null,
      attachments: [],
    })) as ShortMessage[];
    let state = reducer(undefined, messageActions.setActiveRoom(1));
    state = reducer(state, fetchRoomMessages.pending("bench", { roomId: 1 }));
    const start = performance.now();
    state = reducer(
      state,
      fetchRoomMessages.fulfilled({ messages }, "bench", { roomId: 1 }),
    );
    const loadMs = performance.now() - start;
    expect(state.messages).toHaveLength(count);
    expect(new Set(state.messages.map((m) => m.id)).size).toBe(count);
    const editStart = performance.now();
    state = reducer(
      state,
      messageActions.execEventMessage({
        ...messages[count - 1],
        eventType: "MESSAGE_EDIT",
        content: "edit",
        editedAt: "2026-10-18T01:00:00",
      }),
    );
    const editMs = performance.now() - editStart;
    expect(state.messages.at(-1)?.content).toBe("edit");
    const retained = state.messages.length;
    state = reducer(state, messageActions.setActiveRoom(2));
    expect(state.messages).toHaveLength(0);
    expect(Object.keys(state.live)).toHaveLength(0);
    process.stdout.write(
      JSON.stringify({
        scenario: "redux-history",
        count,
        loadMs,
        editMs,
        retained,
        afterSwitch: state.messages.length,
      }) + "\n",
    );
  });
