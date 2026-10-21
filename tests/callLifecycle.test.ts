import { describe, expect, it, vi } from "vitest";
import { Room, RoomEvent, DisconnectReason } from "livekit-client";
import reducer, { callActions, getCallToken, restoreCallSession, takeCallHere } from "../src/store/slices/call.slice";
import { mediaHeaders } from "../src/api/mediaClient";
import { callApi } from "../src/api/callApi";
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
	it("keeps the reserved client ID when retrying a failed transfer", async () => {
		const state = { ...restored(), participantToken: null, mediaOwnership: "PASSIVE" as const };
		const clientId = mediaHeaders["X-Media-Client-Id"];
		const request = vi.spyOn(callApi, "getCallToken").mockRejectedValue(new Error("offline"));
		try {
			await takeCallHere(9)(vi.fn(), () => ({ call: state }) as any, undefined);
			expect(mediaHeaders["X-Media-Client-Id"]).toBe(clientId);
		} finally { request.mockRestore(); }
	});
	it("does not let a passive restore interrupt a transfer", () => {
		let state = { ...restored(), participantToken: null };
		state = reducer(state, takeCallHere.pending("transfer", 9));
		state = reducer(state, restoreCallSession.pending("background", undefined));
		state = reducer(state, restoreCallSession.fulfilled({ ...active(), mediaOwnership: "PASSIVE", participantToken: null }, "background", undefined));
		expect(state.mediaOwnership).toBe("TRANSFERRING");
	});
	it("ends a timed out transfer and ignores its late token", () => {
		let state = { ...restored(), participantToken: null };
		state = reducer(state, takeCallHere.pending("transfer", 9));
		state = reducer(state, callActions.mediaTransferTimedOut(9));
		state = reducer(state, takeCallHere.fulfilled({ callId: 9, mediaOwnership: "OWNED", participantToken: "late", serverUrl: "ws://media" }, "transfer", 9));
		expect(state).toMatchObject({ mediaOwnership: "PASSIVE", participantToken: null, tokenRequestId: null });
		expect(state.error).toContain("другом клиенте");
	});
	it("an explicit rejoin waits for cleanup of its previous media owner", () => {
		let state = reducer(undefined, callActions.prepareJoinedCall({ callId: 9, chatRoomId: 1, roomType: "GROUP", livekitRoomName: "call-9", callerUsername: "alice", hostUsername: "alice" }));
		state = reducer(state, getCallToken.pending("rejoin", 9));
		state = reducer(state, getCallToken.fulfilled({ callId: 9, participantToken: null, serverUrl: null, mediaOwnership: "PASSIVE" }, "rejoin", 9));
		expect(state).toMatchObject({ callId: 9, mediaOwnership: "TRANSFERRING", participantToken: null });
	});
	it("passive restore retains the call without mounting media", () => {
		let state = reducer(undefined, restoreCallSession.pending("passive", undefined));
		state = reducer(state, restoreCallSession.fulfilled({ ...active(), participantToken: null, serverUrl: null, mediaOwnership: "PASSIVE" }, "passive", undefined));
		expect(state).toMatchObject({ callId: 9, status: "in_call", mediaOwnership: "PASSIVE", participantToken: null, mediaIntent: false });
	});
	it("handoff fences a late token and keeps the CallSession available", () => {
		let state = restored();
		state = reducer(state, getCallToken.pending("late-token", 9));
		const generation = state.mediaGeneration;
		state = reducer(state, callActions.mediaOwnershipLost({ callId: 9, generation }));
		state = reducer(state, getCallToken.fulfilled({ callId: 9, participantToken: "stale", serverUrl: "ws://media" }, "late-token", 9));
		expect(state).toMatchObject({ callId: 9, mediaOwnership: "PASSIVE", participantToken: null, mediaGeneration: generation + 1 });
		expect(state.closedCallIds).not.toContain(9);
	});
	it("caller accepts without reload and keeps its existing media ownership", () => {
		let state = reducer(undefined, callActions.startOutgoing({ chatRoomId: 1 }));
		state = reducer(state, callActions.applyCallEvent({ type: "CALL_STARTED", callId: 501, chatRoomId: 1, roomType: "PRIVATE", liveKitRoomName: "dm-1-call-501" }));
		state = reducer(state, getCallToken.pending("caller-token", 501));
		state = reducer(state, getCallToken.fulfilled({ callId: 501, participantToken: "media", serverUrl: "ws://localhost:7880" } as any, "caller-token", 501));
		const generation = state.mediaGeneration;
		for (const type of ["CALL_ACCEPTED", "CALL_ACCEPT", "CALL_ACCEPTED"] as const) {
			state = reducer(state, callActions.applyCallEvent({ type, callId: 501, chatRoomId: 1, callStatus: "ACTIVE" }));
			expect(state).toMatchObject({ status: "in_call", callId: 501, participantToken: "media", mediaGeneration: generation });
		}
	});
	it("accept before the start token response keeps the token request and room", () => {
		let state = reducer(undefined, callActions.startOutgoing({ chatRoomId: 1 }));
		state = reducer(state, callActions.applyCallEvent({ type: "CALL_STARTED", callId: 502, chatRoomId: 1, liveKitRoomName: "dm-1-call-502" }));
		state = reducer(state, getCallToken.pending("pending-start", 502));
		state = reducer(state, callActions.applyCallEvent({ type: "CALL_ACCEPTED", callId: 502, chatRoomId: 1, callStatus: "ACTIVE" }));
		expect(state.tokenRequestId).toBe("pending-start");
		state = reducer(state, getCallToken.fulfilled({ callId: 502, participantToken: "media", serverUrl: "ws://localhost:7880" } as any, "pending-start", 502));
		expect(state).toMatchObject({ status: "in_call", callId: 502, livekitRoomName: "dm-1-call-502", participantToken: "media" });
	});
	it("accept invalidates a stale reconnect NONE response", () => {
		let state = restored();
		state = reducer(state, restoreCallSession.pending("reconnect-before-accept", undefined));
		state = reducer(state, callActions.applyCallEvent({ type: "CALL_ACCEPTED", callId: 9 }));
		state = reducer(state, restoreCallSession.fulfilled({ callRestoreType: "NONE" } as any, "reconnect-before-accept", undefined));
		expect(state).toMatchObject({ status: "in_call", callId: 9, participantToken: "media" });
	});
	it("duplicate identity clears local media ownership through the terminal callback", () => {
		const room = new Room();
		let state = restored();
		const generation = state.mediaGeneration;
		const unbind = bindCallRoomLifecycle(room, vi.fn(), () => {
			state = reducer(state, callActions.mediaSessionEnded({ roomName: "call-9", generation }));
		});
		room.emit(RoomEvent.Disconnected, DisconnectReason.DUPLICATE_IDENTITY);
		expect(state).toMatchObject({ status: "ended", callId: null, participantToken: null });
		expect(state.closedCallIds).toContain(9);
		unbind();
	});
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
