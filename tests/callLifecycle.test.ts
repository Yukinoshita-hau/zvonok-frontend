import { describe, expect, it, vi } from "vitest";
import { Room, RoomEvent, DisconnectReason } from "livekit-client";
import reducer, { callActions, getCallToken, restoreCallSession } from "../src/store/slices/call.slice";
import { bindCallRoomLifecycle } from "../src/components/ActiveCallOverlay/callRoomLifecycle";
import activeReducer, { activeCallActions, getActiveCall } from "../src/store/slices/activeCall.slice";

const active = (id = 9, token = "media") => ({ callRestoreType: "ACTIVE_CALL", restorable: true,
	callId: id, chatRoomId: 1, roomId: 1, roomType: "GROUP", liveKitRoomName: `call-${id}`,
	participantToken: token, serverUrl: "wss://media.test" } as any);
const restored = (state = reducer(undefined, { type: "init" }), id = 9) => {
	state = reducer(state, restoreCallSession.pending("initial", undefined));
	return reducer(state, restoreCallSession.fulfilled(active(id), "initial", undefined));
};

describe("call state reconciliation and response identity", () => {
	it("expired group invitation closes incoming UI without affecting an active media call", () => {
		let incoming = reducer(undefined, callActions.applyCallEvent({ type: "CALL_INVITE", callId: 9 } as any));
		incoming = reducer(incoming, callActions.incomingInvitationExpired(9));
		expect(incoming.status).toBe("ended");
		const live = reducer(restored(), callActions.incomingInvitationExpired(9));
		expect(live.participantToken).toBe("media");
	});
	it("old room response cannot resurrect a call after a terminal event", () => {
		let state = activeReducer(undefined, getActiveCall.pending("old", 1));
		state = activeReducer(state, activeCallActions.handleCallEvent({ type: "CALL_ENDED", callId: 9, roomId: 1 } as any));
		state = activeReducer(state, getActiveCall.fulfilled({ roomId: 1, activeCall: active() }, "old", 1));
		expect(state.activeCallsByRoomId[1]).toBeUndefined();
	});
	it("old terminal event cannot delete a newer call in the same room", () => {
		let state = activeReducer(undefined, activeCallActions.setActiveCallForRoom({ ...active(10), chatRoomId: 1 }));
		state = activeReducer(state, activeCallActions.handleCallEvent({ type: "CALL_ENDED", callId: 9, roomId: 1 } as any));
		expect(state.activeCallsByRoomId[1].callId).toBe(10);
	});
	it("same live call retains token, presentation and start time after signaling reconnect", () => {
		let state = reducer(restored(), callActions.setPresentationMode("minimized"));
		const startedAt = state.callStartedAtMs, generation = state.mediaGeneration;
		state = reducer(state, restoreCallSession.pending("reconnect", undefined));
		state = reducer(state, restoreCallSession.fulfilled(active(9, "new-token"), "reconnect", undefined));
		expect(state.participantToken).toBe("media");
		expect(state.presentationMode).toBe("minimized");
		expect(state.callStartedAtMs).toBe(startedAt);
		expect(state.mediaGeneration).toBe(generation);
	});
	it("NONE reconciles a missed terminal event even with an existing media token", () => {
		let state = reducer(restored(), restoreCallSession.pending("resync", undefined));
		state = reducer(state, restoreCallSession.fulfilled({ callRestoreType: "NONE" } as any, "resync", undefined));
		expect(state.callId).toBeNull(); expect(state.participantToken).toBeNull();
	});
	it("REST failure preserves media and active call", () => {
		let state = reducer(restored(), restoreCallSession.pending("resync", undefined));
		state = reducer(state, restoreCallSession.rejected(new Error("offline"), "resync", undefined));
		expect(state.status).toBe("in_call"); expect(state.participantToken).toBe("media");
	});
	it("late restore cannot resurrect an ended call", () => {
		let state = reducer(restored(), restoreCallSession.pending("old", undefined));
		state = reducer(state, callActions.endCallLocally());
		state = reducer(state, restoreCallSession.fulfilled(active(), "old", undefined));
		expect(state.callId).toBeNull(); expect(state.participantToken).toBeNull();
	});
	it("old token response and old terminal callback cannot affect a new media session", () => {
		let state = reducer(restored(), getCallToken.pending("old-token", 9));
		const generation = state.mediaGeneration;
		state = reducer(state, callActions.endCallLocally());
		state = restored(state, 10);
		state = reducer(state, getCallToken.fulfilled({ callId: 9, participantToken: "old" } as any, "old-token", 9));
		state = reducer(state, callActions.mediaSessionEnded({ roomName: "call-9", generation }));
		expect(state.callId).toBe(10); expect(state.participantToken).toBe("media");
	});
	it("terminal media disconnect gets a fresh room generation after authorized restore", () => {
		let state = restored();
		const generation = state.mediaGeneration;
		state = reducer(state, callActions.mediaConnectionChanged({ roomName: "call-9", generation, status: "disconnected" }));
		expect(state.participantToken).toBe("media");
		state = reducer(state, restoreCallSession.pending("recovery", undefined));
		state = reducer(state, restoreCallSession.fulfilled(active(9, "renewed"), "recovery", undefined));
		expect(state.participantToken).toBe("renewed"); expect(state.mediaGeneration).toBe(generation + 1);
		state = reducer(state, callActions.mediaSessionEnded({ roomName: "call-9", generation }));
		expect(state.callId).toBe(9);
	});
	it("old call events and unrelated participant join cannot tear down existing media", () => {
		let state = restored();
		state = reducer(state, callActions.applyCallEvent({ type: "CALL_ENDED", callId: 8, eventId: "old" } as any));
		state = reducer(state, callActions.applyCallEvent({ type: "CALL_PARTICIPANT_JOINED", callId: 9, eventId: "new" } as any));
		expect(state.callId).toBe(9); expect(state.status).toBe("in_call");
	});
});

describe("installed LiveKit SDK event integration (no media transport)", () => {
	it("Reconnecting/Reconnected retain a recoverable call; disconnect is distinct", () => {
		const room = new Room(), changed = vi.fn(), ended = vi.fn();
		const unbind = bindCallRoomLifecycle(room, changed, ended);
		room.emit(RoomEvent.Reconnecting); room.emit(RoomEvent.Reconnected);
		room.emit(RoomEvent.Disconnected, DisconnectReason.SIGNAL_CLOSE);
		expect(changed.mock.calls.map(c => c[0])).toEqual(["reconnecting", "connected", "disconnected"]);
		expect(ended).not.toHaveBeenCalled(); unbind();
	});
	it.each([DisconnectReason.ROOM_DELETED, DisconnectReason.PARTICIPANT_REMOVED, DisconnectReason.DUPLICATE_IDENTITY])("terminal server reason %s ends local media", reason => {
		const room = new Room(), ended = vi.fn();
		const unbind = bindCallRoomLifecycle(room, vi.fn(), ended);
		room.emit(RoomEvent.Disconnected, reason); expect(ended).toHaveBeenCalledOnce(); unbind();
	});
	it("unmount removes every listener, including repeated mount/unmount", () => {
		const room = new Room(), changed = vi.fn(), ended = vi.fn();
		for (let i = 0; i < 3; i++) bindCallRoomLifecycle(room, changed, ended)();
		room.emit(RoomEvent.Reconnecting); room.emit(RoomEvent.Reconnected);
		room.emit(RoomEvent.Disconnected, DisconnectReason.ROOM_DELETED);
		expect(changed).not.toHaveBeenCalled(); expect(ended).not.toHaveBeenCalled();
	});
});
