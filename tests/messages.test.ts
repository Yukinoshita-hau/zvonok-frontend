import { describe, expect, it, vi, afterEach } from "vitest";
import { configureStore } from "@reduxjs/toolkit";
import reducer, { fetchRoomMessages, messageActions } from "../src/store/slices/message.slice";
import { roomApi } from "../src/api/roomApi";

const message = (id: number, roomId = 1, eventType = "MESSAGE", content = String(id)) => ({ id, room: { id: roomId, type: "PRIVATE" }, eventType, content, sentAt: `2026-10-17T10:00:${String(id).padStart(2, "0")}`, senderId: 1, attachments: [] } as any);
const initial = () => reducer(undefined, messageActions.setActiveRoom(1));
const pending = (id: string, roomId = 1, beforeMessageId?: number) => fetchRoomMessages.pending(id, { roomId, beforeMessageId });
const fulfilled = (id: string, messages: any[], roomId = 1, beforeMessageId?: number) => fetchRoomMessages.fulfilled({ messages, beforeMessageId }, id, { roomId, beforeMessageId });
afterEach(() => vi.restoreAllMocks());

describe("DM and group message history", () => {
	it.each(["PRIVATE", "GROUP"])("slow room A cannot overwrite room B (%s)", type => {
		let state = reducer(initial(), pending("A"));
		state = reducer(state, messageActions.setActiveRoom(2));
		state = reducer(state, pending("B", 2));
		const b = message(2, 2), a = message(1);
		b.room.type = type; a.room.type = type;
		state = reducer(state, fulfilled("B", [b], 2));
		state = reducer(state, fulfilled("A", [a]));
		expect(state.messages.map(m => m.id)).toEqual([2]);
	});
	it("A to B to A rejects the first A requestId", () => {
		let state = reducer(initial(), pending("old"));
		state = reducer(state, messageActions.setActiveRoom(2));
		state = reducer(state, messageActions.setActiveRoom(1));
		state = reducer(state, pending("new"));
		state = reducer(state, fulfilled("new", [message(3)]));
		state = reducer(state, fulfilled("old", [message(1)]));
		expect(state.messages.map(m => m.id)).toEqual([3]);
	});
	it("history and live events merge in order without loss or duplicates", () => {
		let state = reducer(initial(), pending("history"));
		state = reducer(state, messageActions.execEventMessage(message(3)));
		state = reducer(state, messageActions.execEventMessage(message(3)));
		state = reducer(state, fulfilled("history", [message(2), message(1), message(3)]));
		expect(state.messages.map(m => m.id)).toEqual([1, 2, 3]);
	});
	it("in-flight history cannot undo live edits or resurrect deleted messages", () => {
		let state = reducer(initial(), pending("history"));
		state = reducer(state, messageActions.execEventMessage(message(1, 1, "MESSAGE_EDIT", "edited")));
		state = reducer(state, messageActions.execEventMessage(message(2, 1, "MESSAGE_DELETE")));
		state = reducer(state, fulfilled("history", [message(1), message(2)]));
		expect(state.messages.map(m => m.content)).toEqual(["edited"]);
	});
	it("pagination deduplicates overlaps and uses the requested page size", () => {
		let state = reducer(initial(), pending("first"));
		state = reducer(state, fulfilled("first", [message(3), message(4)]));
		state = reducer(state, pending("page", 1, 3));
		state = reducer(state, fulfilled("page", [message(1), message(2), message(3)], 1, 3));
		expect(state.messages.map(m => m.id)).toEqual([1, 2, 3, 4]);
		expect(state.oldestMessageId).toBe(1);
		expect(state.hasMore).toBe(false);
	});
	it("network failure retains loaded history", () => {
		let state = reducer(initial(), pending("first"));
		state = reducer(state, fulfilled("first", [message(1)]));
		state = reducer(state, pending("retry"));
		state = reducer(state, fetchRoomMessages.rejected(new Error("offline"), "retry", { roomId: 1 }));
		expect(state.messages.map(m => m.id)).toEqual([1]);
	});
	it("an edit to an unloaded old message cannot jump the pagination cursor past unseen messages", () => {
		let state = reducer(initial(), pending("first"));
		state = reducer(state, fulfilled("first", [message(5), message(6)]));
		state = reducer(state, pending("page", 1, 5));
		state = reducer(state, messageActions.execEventMessage(message(1, 1, "MESSAGE_EDIT", "old edit")));
		state = reducer(state, fulfilled("page", [message(3), message(4)], 1, 5));
		expect(state.messages.map(m => m.id)).toEqual([3, 4, 5, 6]);
		expect(state.oldestMessageId).toBe(3);
	});
	it("reconnect synchronizes more than one page and removes missed deletions", async () => {
		const store = configureStore({ reducer: { message: reducer } });
		store.dispatch(messageActions.setActiveRoom(1));
		store.dispatch(pending("old")); store.dispatch(fulfilled("old", [message(1), message(2)]));
		const asResponse = (id: number) => ({ ...message(id), sender: { id: 1, username: "me" } });
		const request = vi.spyOn(roomApi, "getRoomMessage").mockResolvedValueOnce({ data: Array.from({ length: 15 }, (_, i) => asResponse(i + 4)) } as any)
			.mockResolvedValueOnce({ data: [asResponse(1), asResponse(3)] } as any);
		await store.dispatch(fetchRoomMessages({ roomId: 1, resync: true }));
		expect(request).toHaveBeenCalledTimes(2);
		expect(request.mock.calls[1][0].beforeMessageId).toBe(4);
		expect(store.getState().message.messages.map(m => m.id)).toEqual([1, ...Array.from({ length: 16 }, (_, i) => i + 3)]);
	});
});
