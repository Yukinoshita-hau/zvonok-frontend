import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { callApi } from "../../api/callApi";
import type { CallTokenDto } from "../../api/interfaces/CallTokenDto";
import type { BaseCallEvent } from "../interfaces/callEvents.interface";
import { type CallRoomType, type callStatus } from "../interfaces/call.types";
import type { RestoreCallSessionResponse } from "../../api/interfaces/RestoreCallSessionResponse";

export type CallPresentationMode = "expanded" | "minimized" | "hidden";

export interface CallState {
	status: callStatus;
	direction: "incoming" | "outgoing" | null;
	callId: number | null;
	chatRoomId: number | null;
	roomType: CallRoomType | null;
	callerUsername: string | null;
	hostUsername: string | null;
	peerUsernames: string[];
	livekitRoomName: string | null;
	serverUrl: string | null;
	participantToken: string | null;
	tokenExpiresAt: string | null;
	lastEventId: string | null;
	processedEventIds: string[];
	lastAcceptedCallId: number | null;
	error: string | null;
	selectedScreenTrackSid: string | null;
	presentationMode: CallPresentationMode;
	isCallFocusMode: boolean;
	isTheaterMode: boolean;
}

export const initialState: CallState = {
	status: "idle",
	direction: null,
	callId: null,
	chatRoomId: null,
	roomType: null,
	callerUsername: null,
	hostUsername: null,
	peerUsernames: [],
	livekitRoomName: null,
	serverUrl: null,
	participantToken: null,
	tokenExpiresAt: null,
	lastEventId: null,
	processedEventIds: [],
	lastAcceptedCallId: null,
	error: null,
	selectedScreenTrackSid: null,
	presentationMode: "expanded",
	isCallFocusMode: false,
	isTheaterMode: false,
};

const keepUi = (state: CallState) => ({
	selectedScreenTrackSid: state.selectedScreenTrackSid,
	presentationMode: state.presentationMode,
	isCallFocusMode: state.isCallFocusMode,
	isTheaterMode: state.isTheaterMode,
});

const resetCallState = (state: CallState, status: callStatus = "idle") => {
	const ui = keepUi(state);
	Object.assign(state, initialState, ui, { status })
}

export const getCallToken = createAsyncThunk("call/getCallToken", async (callId: number, thunkAPI) => {
	try {
		const { data } = await callApi.getCallToken(callId);
		return data;
	} catch (e: any) {
		return thunkAPI.rejectWithValue(e?.message ?? "Failed to get livekit token");
	}
});

export const restoreCallSession = createAsyncThunk(
	"call/restoreCallSession",
	async (_, thunkAPI) => {
		try {
			const { data } = await callApi.restoreCallSession();
			return data;
		} catch (e: any) {
			return thunkAPI.rejectWithValue(e?.message ?? "Failed to restore call");
		}
	}
);

export const callSlice = createSlice({
	name: "call",
	initialState,
	reducers: {
		startOutgoing: (state, action: PayloadAction<{ chatRoomId: number }>) => {
			state.status = "outgoing_ringing";
			state.direction = "outgoing";
			state.chatRoomId = action.payload.chatRoomId;
			state.error = null;
			state.serverUrl = null;
			state.participantToken = null;
			state.tokenExpiresAt = null;
			state.lastAcceptedCallId = null;
		},
		applyCallEvent: (state, action: PayloadAction<BaseCallEvent>) => {
			const e = action.payload;
			if (e.eventId && state.processedEventIds.includes(e.eventId)) return;
			if (e.eventId) {
				state.processedEventIds.push(e.eventId);
				if (state.processedEventIds.length > 200) state.processedEventIds.shift();
				state.lastEventId = e.eventId;
			}
			const roomId = e.roomId ?? e.chatRoomId ?? null;
			const lkName = e.livekitRoomName ?? e.liveKitRoomName ?? null;
			if (e.callId) state.callId = e.callId;
			if (roomId) state.chatRoomId = roomId;
			if (e.roomType) state.roomType = e.roomType;
			if (lkName) state.livekitRoomName = lkName;
			if (e.callerUsername || e.fromUser) state.callerUsername = e.callerUsername ?? e.fromUser ?? null;
			if (e.hostUsername) state.hostUsername = e.hostUsername;

			switch (e.type) {
				case "CALL_STARTED":
					state.direction = "outgoing";
					if (state.status === "outgoing_ringing") state.status = "connecting";
					break;
				case "CALL_INVITE":
					if (state.direction !== "outgoing") {
						state.status = "incoming_ringing";
						state.direction = "incoming";
					}
					break;
				case "CALL_ACCEPT":
				case "CALL_ACCEPTED":
					state.status = "connecting";
					break;
				case "CALL_DECLINE":
				case "CALL_DECLINED":
				case "CALL_END":
				case "CALL_ENDED":
				case "CALL_CANCELLED": {
					const ui = keepUi(state);
					Object.assign(state, initialState, ui, { status: "ended" as const });
					break;
				}
				case "CALL_PARTICIPANT_JOINED":
					break;
			}
		},
		markAcceptedHandled: (state, action: PayloadAction<number>) => {
			state.lastAcceptedCallId = action.payload;
		},
		leaveCallLocally: (state) => {
			resetCallState(state, "ended");
		},
		endCallLocally: (state) => {
			resetCallState(state, "ended");
		},
		liveKitDisconnectedLocally: (state) => {
			resetCallState(state, "ended");
		},
		endCall: (state) => {
			resetCallState(state, "ended");
		},
		setSelectedScreenTrackSid: (state, action: PayloadAction<string | null>) => {
			state.selectedScreenTrackSid = action.payload;
		},
		setPresentationMode: (state, action: PayloadAction<CallPresentationMode>) => {
			state.presentationMode = action.payload;
			if (action.payload !== "expanded") {
				state.isCallFocusMode = false;
				state.isTheaterMode = false;
			}
		},
		toggleCallFocusMode: (state) => {
			state.presentationMode = "expanded";
			state.isCallFocusMode = !state.isCallFocusMode;
		},
		setCallFocusMode: (state, action: PayloadAction<boolean>) => {
			if (action.payload) {
				state.presentationMode = "expanded";
				state.isTheaterMode = false;
			}
			state.isCallFocusMode = action.payload;
		},
		setTheaterMode: (state, action: PayloadAction<boolean>) => {
			if (action.payload) {
				state.presentationMode = "expanded";
				state.isCallFocusMode = false;
			}
			state.isTheaterMode = action.payload;
		},
	},
	extraReducers: (builder) => {
		builder
			.addCase(getCallToken.pending, (state) => {
				state.status = "connecting";
			})
			.addCase(getCallToken.fulfilled, (state, action: PayloadAction<CallTokenDto>) => {
				state.serverUrl = action.payload.serverUrl;
				state.participantToken = action.payload.participantToken;
				state.callId = action.payload.callId;
				state.tokenExpiresAt = action.payload.expiresAt ?? null;
				state.status = "in_call";
			})
			.addCase(getCallToken.rejected, (state, action) => {
				state.status = "error";
				state.error = typeof action.payload === "string" ? action.payload : "Failed to get livekit token";
			})


			.addCase(restoreCallSession.pending, (state) => {
				if (state.status === "idle" || state.status === "ended") {
					state.status = "connecting";
				}
			})
			.addCase(restoreCallSession.fulfilled, (state, action: PayloadAction<RestoreCallSessionResponse>) => {
				const data = action.payload;

				if (data.callRestoreType === "NONE") {
					resetCallState(state, "idle")
					return;
				}

				if (data.callRestoreType === "ACTIVE_CALL") {
					state.status = "in_call";
					state.direction = null;
					state.callId = data.callId;
					state.chatRoomId = data.chatRoomId ?? data.roomId ?? null;
					state.roomType = data.roomType;
					state.hostUsername = data.hostUsername;
					state.callerUsername = data.hostUsername;
					state.livekitRoomName = data.liveKitRoomName;
					state.serverUrl = data.serverUrl;
					state.participantToken = data.participantToken;
					state.tokenExpiresAt = data.expiresAt;
					state.error = null;
					state.presentationMode = "expanded";
				}

				if (data.callRestoreType === "INCOMING_CALL") {
					state.status = "incoming_ringing";
					state.direction = "incoming";
					state.hostUsername = data.hostUsername;
					state.callerUsername = data.hostUsername;
					state.callId = data.callId;
					state.chatRoomId = data.chatRoomId ?? data.roomId ?? null;
					state.roomType = data.roomType;
					state.error = null;
				}

			})
			.addCase(restoreCallSession.rejected, (state, action) => {
				state.status = "idle";
				state.error = typeof action.payload === "string" ? action.payload : "Failed to restore call";
			});
	},
});

export default callSlice.reducer;
export const callActions = callSlice.actions;
