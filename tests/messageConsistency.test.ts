import { describe, expect, it, vi, afterEach } from "vitest";
import { configureStore } from "@reduxjs/toolkit";
import { api } from "../src/api/api";
import { messageAttachmentsApi } from "../src/api/messageAttachmentsApi";
import { roomApi } from "../src/api/roomApi";
import reducer, { messageActions, fetchRoomMessages, sendMessageWithAttachments, clearRoomMessages } from "../src/store/slices/message.slice";
import rooms, { fetchMyRooms } from "../src/store/slices/room.slice";

afterEach(() => vi.restoreAllMocks());

const message = (id: number, eventType = "MESSAGE", content = "original", editedAt?: string) => ({
    id, room: { id: 1, type: "GROUP" }, eventType, content, editedAt,
    sentAt: "2026-10-18T00:00:00", senderId: 1, attachments: [],
} as any);

describe("Stage 6 message consistency", () => {
    it("multipart retries carry the same explicit request key", async () => {
        const post = vi.spyOn(api, "post").mockResolvedValue({ data: {} });
        const payload = { files: [], content: "test", clientRequestId: "f586eb52-1957-4b88-95fb-0c915e9dfd57" };
        await messageAttachmentsApi.sendMessageWithAttachments(1, payload);
        await messageAttachmentsApi.sendMessageWithAttachments(1, payload);
        expect(post.mock.calls.map(call => (call[1] as FormData).get("clientRequestId"))).toEqual([payload.clientRequestId, payload.clientRequestId]);
    });
    it("successful upload response displays a saved message when WebSocket publication is lost", async () => {
        const store = configureStore({ reducer: { message: reducer } });
        store.dispatch(messageActions.setActiveRoom(1));
        const response = { ...message(1), sender: { id: 1, username: "me" } };
        vi.spyOn(messageAttachmentsApi, "sendMessageWithAttachments").mockResolvedValue(response);
        vi.spyOn(roomApi, "myRooms").mockResolvedValue({ data: [] } as any);
        await store.dispatch(sendMessageWithAttachments({ roomId: 1, files: [] }));
        expect(store.getState().message.messages.map(m => m.id)).toEqual([1]);
        store.dispatch(messageActions.execEventMessage(message(1)));
        expect(store.getState().message.messages).toHaveLength(1);
    });
    it("clear response resync retains a message committed after clear", async () => {
        const store = configureStore({ reducer: { message: reducer } });
        store.dispatch(messageActions.setActiveRoom(1)); store.dispatch(messageActions.execEventMessage(message(1)));
        vi.spyOn(roomApi, "clearRoomMessages").mockResolvedValue({} as any);
        vi.spyOn(roomApi, "myRooms").mockResolvedValue({ data: [] } as any);
        vi.spyOn(roomApi, "getRoomMessage").mockResolvedValue({ data: [{ ...message(2), sender: { id: 1, username: "me" } }] } as any);
        await store.dispatch(clearRoomMessages({ roomId: 1 }));
        expect(store.getState().message.messages.map(m => m.id)).toEqual([2]);
    });
    it("edit arriving before create retains the edited content when create finally arrives", () => {
        let state = reducer(undefined, messageActions.setActiveRoom(1));
        state = reducer(state, messageActions.execEventMessage(message(1, "MESSAGE_EDIT", "edited", "2026-10-18T01:00:00")));
        state = reducer(state, messageActions.execEventMessage(message(1)));
        expect(state.messages).toHaveLength(1); expect(state.messages[0].content).toBe("edited");
    });
    it("replayed create cannot undo edit in the next history merge", () => {
        let state = reducer(undefined, messageActions.setActiveRoom(1));
        state = reducer(state, messageActions.execEventMessage(message(1)));
        state = reducer(state, messageActions.execEventMessage(message(1, "MESSAGE_EDIT", "edited", "2026-10-18T01:00:00")));
        state = reducer(state, messageActions.execEventMessage(message(1)));
        state = reducer(state, fetchRoomMessages.pending("page", { roomId: 1 }));
        state = reducer(state, fetchRoomMessages.fulfilled({ messages: [message(1)] }, "page", { roomId: 1 }));
        expect(state.messages).toHaveLength(1); expect(state.messages[0].content).toBe("edited");
    });
    it("replayed create and edit cannot resurrect a deleted message", () => {
        let state = reducer(undefined, messageActions.setActiveRoom(1));
        for (const event of [message(1), message(1, "MESSAGE_DELETE"), message(1), message(1, "MESSAGE_EDIT", "late")]) {
            state = reducer(state, messageActions.execEventMessage(event));
        }
        expect(state.messages).toEqual([]);
    });
    it("older edits cannot overwrite a newer revision", () => {
        let state = reducer(undefined, messageActions.setActiveRoom(1));
        for (const event of [message(1), message(1, "MESSAGE_EDIT", "new", "2026-10-18T02:00:00"), message(1, "MESSAGE_EDIT", "old", "2026-10-18T01:00:00")]) {
            state = reducer(state, messageActions.execEventMessage(event));
        }
        expect(state.messages[0].content).toBe("new");
    });
    it("uses server IDs even when the wall clock moves backwards", () => {
        let state = reducer(undefined, messageActions.setActiveRoom(1));
        state = reducer(state, messageActions.execEventMessage({ ...message(2), sentAt: "2026-10-17T00:00:00" }));
        state = reducer(state, messageActions.execEventMessage(message(1)));
        expect(state.messages.map(m => m.id)).toEqual([1, 2]);
    });
    it("late room response cannot restore a stale preview or unread count", () => {
        let state = rooms(undefined, fetchMyRooms.pending("old", undefined));
        state = rooms(state, fetchMyRooms.pending("new", undefined));
        const current = { id: 1, lastMessageId: 2, lastMessageContent: "new", unreadCount: 2 } as any;
        state = rooms(state, fetchMyRooms.fulfilled([current], "new", undefined));
        state = rooms(state, fetchMyRooms.fulfilled([{ ...current, lastMessageId: 1, unreadCount: 1 }], "old", undefined));
        expect(state.rooms[0]).toEqual(current);
    });
});
