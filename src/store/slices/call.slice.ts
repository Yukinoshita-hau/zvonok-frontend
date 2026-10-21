import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "../store";
import { callApi } from "../../api/callApi";
import type { BaseCallEvent } from "../interfaces/callEvents.interface";
import { type CallRoomType, type callStatus } from "../interfaces/call.types";
import { conferenceApi } from "../../api/conferenceApi";
import type { ConferenceCreateResponse, ConferenceJoinResponse } from "../../api/interfaces/ConferenceDtos";
import { parseBackendDateMs } from "../../utils/timeHelpers";

export type CallPresentationMode = "expanded" | "minimized" | "hidden";

export interface ContentPresentationState {
 sourceManual: boolean;
 primaryKey: string | null;
 secondaryKey: string | null;
 split: boolean;
 arrangement: "auto" | "side" | "stacked";
 ratio: number;
 stripHidden: boolean;
}

export interface CallState {
 followSpeaker: boolean;
 pinnedParticipant: string | null;
 content: ContentPresentationState;
	layoutIntent: "auto" | "voice" | "grid" | "focus" | "screen";
	presentationIntent: "automatic" | "manual";
	presentationInitialized: boolean;
	mediaIntent: boolean;
	mediaOwnership: "OWNED" | "PASSIVE" | "TRANSFERRING" | null;
	restoreRequestId: string | null;
	tokenRequestId: string | null;
	mediaState: "connected" | "connecting" | "reconnecting" | "disconnected";
	mediaGeneration: number;
	closedCallIds: number[];
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
	conferenceId: number | null;
	conferenceCode: string | null;
	conferenceJoinUrl: string | null;
	isConferenceHost: boolean;
	lastEventId: string | null;
	processedEventIds: string[];
	lastAcceptedCallId: number | null;
	callStartedAtMs: number | null;
	error: string | null;
	selectedScreenTrackSid: string | null;
	presentationMode: CallPresentationMode;
	isCallFocusMode: boolean;
	isTheaterMode: boolean;
}

export const initialState: CallState = {
 followSpeaker: false,
 pinnedParticipant: null,
 content: { sourceManual: false, primaryKey: null, secondaryKey: null, split: false, arrangement: "auto", ratio: 50, stripHidden: false },
	layoutIntent: "auto",
	presentationIntent: "automatic",
	presentationInitialized: false,
	mediaIntent: false,
	mediaOwnership: null,
	restoreRequestId: null,
	tokenRequestId: null,
	mediaState: "connected",
	mediaGeneration: 0,
	closedCallIds: [],
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
	conferenceId: null,
	conferenceCode: null,
	conferenceJoinUrl: null,
	isConferenceHost: false,
	lastEventId: null,
	processedEventIds: [],
	lastAcceptedCallId: null,
	callStartedAtMs: null,
	error: null,
	selectedScreenTrackSid: null,
	presentationMode: "expanded",
	isCallFocusMode: false,
	isTheaterMode: false,
};

const keepUi = (state: CallState) => ({
	selectedScreenTrackSid: null,
	presentationMode: state.presentationMode,
	isCallFocusMode: state.isCallFocusMode,
	isTheaterMode: state.isTheaterMode,
});

const resetCallState = (state: CallState, status: callStatus = "idle") => {
	const ui = { ...keepUi(state), presentationMode: "expanded" as const, isCallFocusMode: false, isTheaterMode: false };
	const closedCallIds = [...state.closedCallIds];
	if (status === "ended" && state.callId && !closedCallIds.includes(state.callId)) closedCallIds.push(state.callId);
	Object.assign(state, initialState, ui, { status, mediaGeneration: state.mediaGeneration + 1, closedCallIds: closedCallIds.slice(-100) })
}

function parseCallStartedAtMs(value?: string | null): number | null {
	return parseBackendDateMs(value);
}

export const getCallToken = createAsyncThunk("call/getCallToken", async (callId: number, thunkAPI) => {
	try {
		const { data } = await callApi.getCallToken(callId);
		return data;
	} catch (e: any) {
		return thunkAPI.rejectWithValue(e?.message ?? "Failed to get livekit token");
	}
}, { condition: (callId, { getState }) => {
	const call = (getState() as RootState).call;
	return call.callId === callId && !call.tokenRequestId && call.mediaOwnership !== "PASSIVE" && call.mediaOwnership !== "TRANSFERRING";
} });

export const takeCallHere = createAsyncThunk("call/takeCallHere", async (callId: number) => {
	return (await callApi.getCallToken(callId, true)).data;
}, { condition: (callId, { getState }) => {
	const call = (getState() as RootState).call;
	if (call.callId !== callId || call.participantToken || call.tokenRequestId) return false;
	return true;
} });

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

export const createConference = createAsyncThunk(
	"call/createConference",
	async (_, thunkAPI) => {
		try {
			const { data } = await conferenceApi.createConference();
			return data;
		} catch (e: any) {
			return thunkAPI.rejectWithValue(
				e?.response?.data?.message ?? e?.message ?? "Не удалось создать конференцию"
			);
		}
	}
);

export const joinConference = createAsyncThunk(
	"call/joinConference",
	async (code: string, thunkAPI) => {
		try {
			const { data } = await conferenceApi.joinConference(code);
			return data;
		} catch (e: any) {
			return thunkAPI.rejectWithValue({
				message: e?.response?.data?.message ?? e?.message ?? "Не удалось войти в конференцию",
				status: e?.response?.status ?? e?.response?.data?.status ?? 0,
			});
		}
	}
);

export const endConference = createAsyncThunk(
	"call/endConference",
	async (code: string, thunkAPI) => {
		try {
			await conferenceApi.endConference(code);
			return code;
		} catch (e: any) {
			return thunkAPI.rejectWithValue(
				e?.response?.data?.message ?? e?.message ?? "Не удалось завершить конференцию"
			);
		}
	}
);

const applyConferenceConnection = (
	state: CallState,
	data: ConferenceCreateResponse | ConferenceJoinResponse,
	isHost: boolean
) => {
	state.followSpeaker = false;
	state.pinnedParticipant = null;
	state.status = "in_call";
	state.direction = null;
	state.callId = null;
	state.chatRoomId = null;
	state.roomType = "GROUP";
	state.callerUsername = null;
	state.hostUsername = null;
	state.peerUsernames = [];
	state.livekitRoomName = data.livekitRoomName;
	state.serverUrl = data.serverUrl;
	state.participantToken = data.token;
	state.tokenExpiresAt = null;
	state.conferenceId = data.conferenceId;
	state.conferenceCode = data.code;
	state.conferenceJoinUrl = "joinUrl" in data ? data.joinUrl : null;
	state.isConferenceHost = isHost;
	state.callStartedAtMs = Date.now();
	state.error = null;
	state.presentationMode = "expanded";
	state.isCallFocusMode = false;
	state.isTheaterMode = false;
};

export const callSlice = createSlice({
	name: "call",
	initialState,
	reducers: {
		requestMedia: (state) => { state.mediaIntent = true; },
		mediaTransferTimedOut: (state, action: PayloadAction<number>) => {
			if (state.callId !== action.payload || state.mediaOwnership !== "TRANSFERRING") return;
			state.mediaOwnership = "PASSIVE";
			state.mediaIntent = false;
			state.tokenRequestId = null;
			state.error = "Не удалось освободить звонок на другом клиенте. Закройте звонок там и попробуйте снова. После аварийного закрытия клиента защитное ожидание сервера может занять несколько минут.";
		},
		mediaOwnershipLost: (state, action: PayloadAction<{ callId: number; generation: number }>) => {
			if (state.callId !== action.payload.callId || state.mediaGeneration !== action.payload.generation) return;
			state.mediaOwnership = "PASSIVE";
			state.mediaIntent = false;
			state.participantToken = null;
			state.tokenRequestId = null;
			state.restoreRequestId = null;
			state.mediaGeneration++;
		},
		startOutgoing: (state, action: PayloadAction<{ chatRoomId: number }>) => {
			resetCallState(state);
			state.mediaIntent = true;
			state.status = "outgoing_ringing";
			state.direction = "outgoing";
			state.chatRoomId = action.payload.chatRoomId;
			state.error = null;
			state.serverUrl = null;
			state.participantToken = null;
			state.tokenExpiresAt = null;
			state.lastAcceptedCallId = null;
			state.callStartedAtMs = null;
		},
		applyCallEvent: (state, action: PayloadAction<BaseCallEvent>) => {
			const e = action.payload;
			if (state.status === "outgoing_ringing" && e.type === "CALL_INVITE") return;
			if (e.callId && state.closedCallIds.includes(e.callId)) return;
			if (state.conferenceCode || (state.callId && e.callId && state.callId !== e.callId)) return;
			if (!state.callId && !["CALL_INVITE", "CALL_STARTED"].includes(e.type)) return;
			if (e.eventId && state.processedEventIds.includes(e.eventId)) return;
			state.restoreRequestId = null;
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
					if (state.direction !== "outgoing" && !state.participantToken) {
						state.status = "incoming_ringing";
						state.direction = "incoming";
					}
					break;
				case "CALL_ACCEPT":
				case "CALL_ACCEPTED":
				case "CALL_PARTICIPANT_JOINED":
					if (!state.participantToken) state.status = "connecting";
					break;
				case "CALL_DECLINE":
				case "CALL_DECLINED":
				case "CALL_END":
				case "CALL_ENDED":
				case "CALL_CANCELLED": {
					resetCallState(state, "ended");
					break;
				}
					break;
			}
		},
		markAcceptedHandled: (state, action: PayloadAction<number>) => {
			state.lastAcceptedCallId = action.payload;
		},
		incomingInvitationExpired: (state, action: PayloadAction<number>) => {
			if (state.callId === action.payload && state.status === "incoming_ringing") resetCallState(state, "ended");
		},
		prepareJoinedCall: (state, action: PayloadAction<{ callId: number; chatRoomId: number; roomType: CallRoomType; livekitRoomName: string; callerUsername: string; hostUsername: string }>) => {
			resetCallState(state);
			state.mediaIntent = true;
			state.closedCallIds = state.closedCallIds.filter(id => id !== action.payload.callId);
			state.status = "connecting";
			state.direction = null;
			state.callId = action.payload.callId;
			state.chatRoomId = action.payload.chatRoomId;
			state.roomType = action.payload.roomType;
			state.livekitRoomName = action.payload.livekitRoomName;
			state.callerUsername = action.payload.callerUsername;
			state.hostUsername = action.payload.hostUsername;
			state.error = null;
			state.presentationMode = "expanded";
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
		mediaConnectionChanged: (state, action: PayloadAction<{ roomName: string; generation: number; status: CallState["mediaState"] }>) => {
			if (state.livekitRoomName !== action.payload.roomName || state.mediaGeneration !== action.payload.generation) return;
			state.mediaState = action.payload.status;
		},
		mediaSessionEnded: (state, action: PayloadAction<{ roomName: string; generation: number }>) => {
			if (state.livekitRoomName !== action.payload.roomName || state.mediaGeneration !== action.payload.generation) return;
			resetCallState(state, "ended");
		},
		endCall: (state) => {
			resetCallState(state, "ended");
		},
        setFollowSpeaker: (state, action: PayloadAction<boolean>) => {
            state.followSpeaker = action.payload;
            if (action.payload) state.pinnedParticipant = null;
        },
        setPinnedParticipant: (state, action: PayloadAction<string | null>) => {
            state.pinnedParticipant = action.payload;
        },
        setContentPresentation: (state, action: PayloadAction<Partial<ContentPresentationState>>) => {
            Object.assign(state.content, action.payload);
            state.content.ratio = Number.isFinite(state.content.ratio) ? Math.max(30, Math.min(70, state.content.ratio)) : 50;
            if (state.content.primaryKey === state.content.secondaryKey) state.content.secondaryKey = null;
        },
		setSelectedScreenTrackSid: (state, action: PayloadAction<string | null>) => {
			state.selectedScreenTrackSid = action.payload;
		},
		initializePresentation: (state, action: PayloadAction<{ hasVideo: boolean }>) => {
            if (state.presentationInitialized || state.mediaState !== "connected" || state.status !== "in_call") return;
            state.presentationInitialized = true;
            if (state.presentationIntent === "manual") return;
            if (state.chatRoomId && !state.conferenceCode && !action.payload.hasVideo) {
                state.presentationMode = "minimized";
                state.layoutIntent = "voice";
            }
        },
        setLayoutIntent: (state, action: PayloadAction<CallState["layoutIntent"]>) => {
            state.layoutIntent = action.payload;
            state.presentationIntent = "manual";
        },
        setPresentationMode: (state, action: PayloadAction<CallPresentationMode>) => {
            state.presentationIntent = "manual";
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
			.addCase(getCallToken.pending, (state, action) => {
				if (state.callId !== action.meta.arg) return;
				state.tokenRequestId = action.meta.requestId;
				if (!state.participantToken) state.status = "connecting";
			})
			.addCase(getCallToken.fulfilled, (state, action) => {
				if (state.tokenRequestId !== action.meta.requestId || state.callId !== action.meta.arg) return;
				state.tokenRequestId = null;
				state.mediaOwnership = action.payload.mediaOwnership === "PASSIVE" && state.mediaIntent
					? "TRANSFERRING" : action.payload.mediaOwnership ?? "OWNED";
				state.mediaIntent = state.mediaOwnership === "OWNED";
				state.serverUrl = action.payload.serverUrl;
				state.participantToken = action.payload.participantToken;
				state.callId = action.payload.callId;
				state.tokenExpiresAt = action.payload.expiresAt ?? null;
				state.status = "in_call";
				state.callStartedAtMs = state.callStartedAtMs
					?? parseCallStartedAtMs(action.payload.startedAt)
					?? parseCallStartedAtMs(action.payload.activatedAt)
					?? Date.now();
			})
			.addCase(getCallToken.rejected, (state, action) => {
				if (state.tokenRequestId !== action.meta.requestId || state.callId !== action.meta.arg) return;
				state.tokenRequestId = null;
				if (state.participantToken) return;
				state.status = "error";
				state.error = typeof action.payload === "string" ? action.payload : "Failed to get livekit token";
			})


			.addCase(restoreCallSession.pending, (state, action) => {
				state.restoreRequestId = action.meta.requestId;
				if (state.status === "idle" || state.status === "ended") {
					state.status = "connecting";
				}
			})
			.addCase(restoreCallSession.fulfilled, (state, action) => {
				if (state.restoreRequestId !== action.meta.requestId) return;
				state.restoreRequestId = null;
				const data = action.payload;
				if (data.callId && state.closedCallIds.includes(data.callId)) return;
				if (data.callId === state.callId && data.mediaOwnership === "PASSIVE" && state.mediaOwnership === "TRANSFERRING") return;

				if (state.conferenceCode) {
					return;
				}
				if (data.callId === state.callId && data.callRestoreType === "ACTIVE_CALL" && state.participantToken) {
					if (state.mediaState !== "disconnected") return;
					state.mediaGeneration++;
				}

				if (data.callRestoreType === "NONE") {
					resetCallState(state, state.callId ? "ended" : "idle")
					return;
				}

				if (data.callRestoreType === "ACTIVE_CALL") {
                    if (data.callId !== state.callId) { state.followSpeaker = false; state.pinnedParticipant = null; state.content = { ...initialState.content }; state.layoutIntent = "auto"; state.presentationIntent = "automatic"; state.presentationInitialized = false; }
					state.mediaOwnership = data.mediaOwnership ?? "OWNED";
					state.mediaIntent = state.mediaOwnership === "OWNED";
					state.mediaState = "connecting";
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
					state.callStartedAtMs = parseCallStartedAtMs(data.startedAt)
						?? parseCallStartedAtMs(data.activatedAt)
						?? Date.now();
					state.error = null;
					if (!state.presentationInitialized) state.presentationMode = "expanded";
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
				if (state.restoreRequestId !== action.meta.requestId) return;
				state.restoreRequestId = null;
				if (state.conferenceCode || (state.status === "in_call" && state.participantToken)) {
					return;
				}
				state.status = "idle";
				state.error = typeof action.payload === "string" ? action.payload : "Failed to restore call";
			})
			.addCase(createConference.pending, (state) => {
				state.status = "connecting";
				state.error = null;
			})
			.addCase(createConference.fulfilled, (state, action: PayloadAction<ConferenceCreateResponse>) => {
				applyConferenceConnection(state, action.payload, true);
			})
			.addCase(createConference.rejected, (state, action) => {
				state.status = "error";
				state.error = typeof action.payload === "string" ? action.payload : "Не удалось создать конференцию";
			})
			.addCase(joinConference.pending, (state) => {
				state.status = "connecting";
				state.error = null;
			})
			.addCase(joinConference.fulfilled, (state, action: PayloadAction<ConferenceJoinResponse>) => {
				applyConferenceConnection(state, action.payload, false);
			})
			.addCase(joinConference.rejected, (state, action) => {
				state.status = "error";
				const payload = action.payload as { message?: string } | string | undefined;
				state.error = typeof payload === "string" ? payload : payload?.message ?? "Не удалось войти в конференцию";
			})
			.addCase(endConference.fulfilled, (state) => {
				resetCallState(state, "ended");
			})
			.addCase(endConference.rejected, (state, action) => {
				state.error = typeof action.payload === "string" ? action.payload : "Не удалось завершить конференцию";
			})
			.addCase(takeCallHere.pending, (state, action) => {
				if (state.callId !== action.meta.arg || state.participantToken) return;
				state.mediaOwnership = "TRANSFERRING";
				state.mediaIntent = true;
				state.tokenRequestId = action.meta.requestId;
				state.error = null;
			})
			.addCase(takeCallHere.fulfilled, (state, action) => {
				if (state.callId !== action.meta.arg || state.tokenRequestId !== action.meta.requestId) return;
				state.tokenRequestId = null;
				if (action.payload.mediaOwnership === "PASSIVE") return;
				state.mediaOwnership = "OWNED";
				state.serverUrl = action.payload.serverUrl;
				state.participantToken = action.payload.participantToken;
				state.status = "in_call";
			})
			.addCase(takeCallHere.rejected, (state, action) => {
				if (state.tokenRequestId !== action.meta.requestId) return;
				state.tokenRequestId = null;
				state.mediaOwnership = "PASSIVE";
				state.mediaIntent = false;
				state.error = "Не удалось перенести звонок. Попробуйте ещё раз.";
			});
	},
});

export default callSlice.reducer;
export const callActions = callSlice.actions;
