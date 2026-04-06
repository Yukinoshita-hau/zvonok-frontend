import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { type callStatus } from "../interfaces/call.types"
import type { CallInviteEvent } from "../interfaces/callEvents.interface";
import { livekitApi } from "../../api/livekitApi";

export interface CallState {
	status: callStatus
	direction: "incoming" | "outgoing" | null;
	chatRoomId: number | null;
	callerUsername: string | null;
	livekitRoomName: string | null;
	serverUrl: string | null;
	participantToken: string | null;
	error: string | null;

	selectedScreenTrackSid: string | null;
	isCallFocusMode: boolean;
	isChatHiddenInCall: boolean;
}

export const initialState: CallState = {
	status: "idle",
	direction: null,
	chatRoomId: null,
	callerUsername: null,
	livekitRoomName: null,
	serverUrl: null,
	participantToken: null,
	error: null,


	selectedScreenTrackSid: null,
	isCallFocusMode: false,
	isChatHiddenInCall: false,
}

export const getToken = createAsyncThunk(
	"call/getToken",
	async (param: string, thunkAPI) => {
		try {
			const { data } = await livekitApi.getToken(param);
			return data;
		} catch (e: any) {
			return thunkAPI.rejectWithValue(e?.message ?? "Failed to get livekit token");
		}
	}
)

export const callSlice = createSlice({
	name: "call",
	initialState: initialState,
	reducers: {
		startOutgoing: (previousState, action: PayloadAction<{
			chatRoomId: number,
			livekitRoomName: string,
			peerUsernames: string[]
		}>) => {
			previousState.status = "outgoing_ringing";
			previousState.direction = "outgoing";
			previousState.chatRoomId = action.payload.chatRoomId;
			previousState.livekitRoomName = action.payload.livekitRoomName;
		},
		incomingInvite: (previousState, action: PayloadAction<CallInviteEvent>) => {
			previousState.status = "incoming_ringing";
			previousState.direction = "incoming";
			previousState.chatRoomId = action.payload.chatRoomId;
			previousState.livekitRoomName = action.payload.liveKitRoomName;
			previousState.callerUsername = action.payload.fromUser;
		},
		setConnecting: (previousState) => {
			previousState.status = "connecting";
		},
		setLivekitCredentials: (previousState, action: PayloadAction<{
			serverUrl: string,
			participantToken: string,
		}>) => {
			previousState.serverUrl = action.payload.serverUrl;
			previousState.participantToken = action.payload.participantToken;
		},
		setConnected: (previousState) => {
			previousState.status = "in_call";
		},
		declineCall: (previousState) => {
			previousState.status = "ended";
		},
		endCall: () => {
			return initialState;
		},
		setSelectedScreenTrackSid: (previousState, action: PayloadAction<string | null>) => {
			previousState.selectedScreenTrackSid = action.payload;
		},

		toggleCallFocusMode: (previousState) => {
			previousState.isCallFocusMode = !previousState.isCallFocusMode;
		},

		toggleChatHiddenInCall: (previousState) => {
			previousState.isChatHiddenInCall = !previousState.isChatHiddenInCall;
		},

		setCallFocusMode: (previousState, action: PayloadAction<boolean>) => {
			previousState.isCallFocusMode = action.payload;
		},

		setChatHiddenInCall: (previousState, action: PayloadAction<boolean>) => {
			previousState.isChatHiddenInCall = action.payload;
		}
	},
	extraReducers: builder => {
		builder
			.addCase(getToken.pending, currentState => {
				currentState.status = "connecting";
			})
			.addCase(getToken.fulfilled, (currentState, action) => {
				currentState.serverUrl = action.payload.serverUrl;
				currentState.participantToken = action.payload.participantToken;
				currentState.status = "in_call";
			})

			.addCase(getToken.rejected, (currentState, action) => {
				currentState.status = "error"
				currentState.error = typeof action.payload === "string" ? action.payload : "Failed to get livekit token";
			})
	}
})

export default callSlice.reducer;
export const callActions = callSlice.actions;
