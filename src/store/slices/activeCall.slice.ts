import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { callApi } from "../../api/callApi";
import type { ActiveCallResponse } from "../../api/interfaces/ActiveCallResponse";
import type { JoinCallDto } from "../../api/interfaces/CallDtos";
import type { CallParticipantStatus } from "../../api/interfaces/CallParticipantResponse";
import type { BaseCallEvent } from "../interfaces/callEvents.interface";

export interface ActiveCallState {
	activeCallsByRoomId: Record<number, ActiveCallResponse>;
	incomingCall: BaseCallEvent | null;
	currentCallId: number | null;
	currentRoomId: number | null;
	status: "idle" | "ringing" | "connecting" | "in-call" | "ended";
	error: string | null;
	joinStatus: "idle" | "loading" | "succeeded" | "failed";
	joinError: string | null;
}

export const initialState: ActiveCallState = {
	activeCallsByRoomId: {},
	incomingCall: null,
	currentCallId: null,
	currentRoomId: null,
	status: "idle",
	error: null,
	joinStatus: "idle",
	joinError: null,
};

const eventToActiveCall = (event: BaseCallEvent): ActiveCallResponse | null => {
	const chatRoomId = event.chatRoomId ?? event.roomId;
	if (!event.callId || !chatRoomId || !event.roomType || !event.liveKitRoomName) return null;

	return {
		callId: event.callId,
		chatRoomId,
		roomId: event.roomId ?? chatRoomId,
		roomType: event.roomType,
		status: event.callStatus === "ENDED" ? "ENDED" : event.callStatus === "ACTIVE" ? "ACTIVE" : "RINGING",
		liveKitRoomName: event.liveKitRoomName,
		hostUsername: event.hostUsername ?? "",
		callerUsername: event.callerUsername ?? event.fromUser ?? "",
		callType: event.callType ?? "audio",
		participantsCount: event.participantsCount,
		participants: event.participantUsername
			? [{
				userId: 0,
				username: event.participantUsername,
				displayName: null,
				avatarUrl: null,
				status: event.participantStatus ?? "RINGING",
				joinedAt: null,
				acceptedAt: null,
				leftAt: null,
			}]
			: [],
		startedAt: null,
		activatedAt: null,
		createAt: null,
	};
};

export const getActiveCall = createAsyncThunk("activeCall/getActiveCall", async (roomId: number, thunkAPI) => {
	try {
		const { data } = await callApi.getActiveCallByRoomId(roomId);
		return { roomId, activeCall: data };
	} catch (e: any) {
		if (e?.response?.status === 404) return { roomId, activeCall: null };
		return thunkAPI.rejectWithValue(e?.message ?? "Failed to get active call");
	}
});

export const joinActiveCall = createAsyncThunk("activeCall/joinActiveCall", async (dto: JoinCallDto, thunkAPI) => {
	try {
		const { data } = await callApi.joinCall(dto);
		return data;
	} catch (e: any) {
		return thunkAPI.rejectWithValue(e?.message ?? "Failed to join call");
	}
});

export const activeCallSlice = createSlice({
	name: "activeCall",
	initialState,
	reducers: {
		setActiveCallForRoom: (state, action: PayloadAction<ActiveCallResponse>) => {
			state.activeCallsByRoomId[action.payload.chatRoomId] = action.payload;
			state.error = null;
		},
		removeActiveCallForRoom: (state, action: PayloadAction<number>) => {
			delete state.activeCallsByRoomId[action.payload];
		},
		clearActiveCallForRoom: (state, action: PayloadAction<number>) => {
			delete state.activeCallsByRoomId[action.payload];
		},
		clearCall: (state) => {
			state.activeCallsByRoomId = {};
		},
		setIncomingCall: (state, action: PayloadAction<BaseCallEvent>) => {
			state.incomingCall = action.payload;
			state.status = "ringing";
		},
		clearIncomingCall: (state) => {
			state.incomingCall = null;
		},
		setCurrentCall: (state, action: PayloadAction<{ callId: number | null; roomId: number | null }>) => {
			state.currentCallId = action.payload.callId;
			state.currentRoomId = action.payload.roomId;
			state.status = action.payload.callId ? "in-call" : "idle";
		},
		updateParticipantStatusInActiveCall: (state, action: PayloadAction<{ roomId: number; username?: string | null; status: CallParticipantStatus }>) => {
			const activeCall = state.activeCallsByRoomId[action.payload.roomId];
			if (!activeCall || !action.payload.username) return;
			const participant = activeCall.participants.find((p) => p.username === action.payload.username);
			if (participant) participant.status = action.payload.status;
		},
		handleCallEvent: (state, action: PayloadAction<BaseCallEvent>) => {
			const event = action.payload;
			const roomId = event.chatRoomId ?? event.roomId;
			if (!roomId) return;

			if (event.type === "CALL_ENDED") {
				delete state.activeCallsByRoomId[roomId];
				if (state.incomingCall?.callId === event.callId) state.incomingCall = null;
				if (state.currentCallId === event.callId) state.status = "ended";
				return;
			}

			if (event.type === "CALL_INVITE" || event.type === "CALL_STARTED") {
				const activeCall = eventToActiveCall(event);
				if (activeCall) state.activeCallsByRoomId[roomId] = activeCall;
				if (event.type === "CALL_INVITE") state.incomingCall = event;
				return;
			}

			const statusByType: Partial<Record<string, CallParticipantStatus>> = {
				CALL_ACCEPT: "ACCEPTED",
				CALL_ACCEPTED: "ACCEPTED",
				CALL_PARTICIPANT_JOINED: "JOINED",
				CALL_PARTICIPANT_DECLINED: "DECLINED",
				CALL_DECLINE: "DECLINED",
				CALL_DECLINED: "DECLINED",
				CALL_PARTICIPANT_LEFT: "LEFT",
			};

			const participantStatus = statusByType[event.type];
			const activeCall = state.activeCallsByRoomId[roomId];
			if (activeCall && event.callStatus === "ACTIVE") activeCall.status = "ACTIVE";
			if (participantStatus && activeCall && event.participantUsername) {
				const participant = activeCall.participants.find((p) => p.username === event.participantUsername);
				if (participant) participant.status = participantStatus;
			}
		},
	},
	extraReducers: (builder) => {
		builder
			.addCase(getActiveCall.rejected, (state, action) => {
				state.error = typeof action.payload === "string" ? action.payload : "Failed to get active call";
			})
			.addCase(getActiveCall.fulfilled, (state, action: PayloadAction<{ roomId: number; activeCall: ActiveCallResponse | null }>) => {
				if (action.payload.activeCall) {
					state.activeCallsByRoomId[action.payload.roomId] = action.payload.activeCall;
				} else {
					delete state.activeCallsByRoomId[action.payload.roomId];
				}
				state.error = null;
			})
			.addCase(joinActiveCall.pending, (state) => {
				state.joinStatus = "loading";
				state.joinError = null;
			})
			.addCase(joinActiveCall.fulfilled, (state, action: PayloadAction<ActiveCallResponse>) => {
				state.activeCallsByRoomId[action.payload.chatRoomId] = action.payload;
				state.currentCallId = action.payload.callId;
				state.currentRoomId = action.payload.chatRoomId;
				state.status = "connecting";
				state.joinStatus = "succeeded";
			})
			.addCase(joinActiveCall.rejected, (state, action) => {
				state.joinStatus = "failed";
				state.joinError = typeof action.payload === "string" ? action.payload : "Failed to join call";
			});
	},
});

export default activeCallSlice.reducer;
export const activeCallActions = activeCallSlice.actions;
