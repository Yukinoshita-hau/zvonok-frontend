import { createAsyncThunk, createSlice, current, type PayloadAction } from "@reduxjs/toolkit";
import type { Friend } from "../../entities/friend";
import { friendApi } from "../../api/friendApi";
import type { FriendRequest } from "../../api/interfaces/FriendRequest";

export interface FriendState {
	friends: Friend[];
	incomingRequests: FriendRequest[];
	outgoingRequests: FriendRequest[];
	status: "idle" | "loading" | "succeeded" | "failed";
	error: string | null;
}

const initialState: FriendState = {
	friends: [],
	incomingRequests: [],
	outgoingRequests: [],
	status: "idle",
	error: null,
};

export const fetchMyFriends = createAsyncThunk(
	"friend/fetchFriends",
	async (_, thunkAPI) => {
		try {
			const { data } = await friendApi.myFriends();
			return data;
		} catch (e: any) {
			return thunkAPI.rejectWithValue(e?.message ?? "Failed to load friends");
		}
	}
)

export const fetchIncomingRequests = createAsyncThunk(
	"friend/fetchIncoming",
	async (_, thunkAPI) => {
		try {
			const { data } = await friendApi.incomingRequests();
			return data;
		} catch (e: any) {
			return thunkAPI.rejectWithValue(e?.message ?? "Failed to load incoming requests");
		}
	}
)

export const fetchOutgoingRequests = createAsyncThunk(
	"friend/fetchOutgoing",
	async (_, thunkAPI) => {
		try {
			const { data } = await friendApi.outgoingRequests();
			return data;
		} catch (e: any) {
			return thunkAPI.rejectWithValue(e?.message ?? "Failed to load outgoing requests");
		}
	}
)

export const acceptFriendRequest = createAsyncThunk(
	"friend/acceptRequest",
	async (requestId: number, thunkAPI) => {
		try {
			const { data } = await friendApi.acceptRequest(requestId);
			return data;
		} catch (e: any) {
			return thunkAPI.rejectWithValue(e?.message ?? "Failed to accept request");
		}
	}
)

export const rejectFriendRequest = createAsyncThunk(
	"friend/rejectRequest",
	async (requestId: number, thunkAPI) => {
		try {
			const { data } = await friendApi.rejectRequest(requestId);
			return data;
		} catch (e: any) {
			return thunkAPI.rejectWithValue(e?.message ?? "Failed to reject request");
		}
	}
)

export const cancelFriendRequest = createAsyncThunk(
	"friend/cancelRequest",
	async (requestId: number, thunkAPI) => {
		try {
			const { data } = await friendApi.cancelRequest(requestId);
			return data;
		} catch (e: any) {
			return thunkAPI.rejectWithValue(e?.message ?? "Failed to cancel request");
		}
	}
)

export const friendSlice = createSlice({
	name: "friend",
	initialState: initialState,
	reducers: {
		sendFriendRequest: (currentState, action: PayloadAction<{
			username: string;
		}>) => { },
		acceptFriendRequest: (currentState, action: PayloadAction<{
			requestId: number;
		}>) => { },
		rejectFriendRequest: (currentState, action: PayloadAction<{
			requestId: number
		}>) => { },
		cancelFriendRequest: (currentState, action: PayloadAction<{
			requestId: number
		}>) => { },
		removeFriend: (currentState, action: PayloadAction<{
			friendUsername: string
		}>) => { },
	},
	extraReducers: builder => {
		builder
			.addCase(fetchMyFriends.pending, currentState => {
				currentState.status = "loading";
				currentState.error = null;
			})
			.addCase(fetchMyFriends.fulfilled, (currentState, action: PayloadAction<Friend[]>) => {
				currentState.status = "succeeded";
				currentState.friends = action.payload;
			})
			.addCase(fetchMyFriends.rejected, (currentState, action) => {
				currentState.status = "failed";
				currentState.error = typeof action.payload === "string" ? action.payload : "Unknown error";
			})


			.addCase(fetchIncomingRequests.pending, currentState => {
				currentState.status = "loading";
				currentState.error = null;
			})
			.addCase(fetchIncomingRequests.fulfilled, (currentState, action: PayloadAction<FriendRequest[]>) => {
				currentState.status = "succeeded";
				currentState.incomingRequests = action.payload;
			})
			.addCase(fetchIncomingRequests.rejected, (currentState, action) => {
				currentState.status = "failed";
				currentState.error = typeof action.payload === "string" ? action.payload : "Unknown error";
			})


			.addCase(fetchOutgoingRequests.pending, currentState => {
				currentState.status = "loading";
				currentState.error = null;
			})
			.addCase(fetchOutgoingRequests.fulfilled, (currentState, action: PayloadAction<FriendRequest[]>) => {
				currentState.status = "succeeded";
				currentState.outgoingRequests = action.payload;
			})
			.addCase(fetchOutgoingRequests.rejected, (currentState, action) => {
				currentState.status = "failed";
				currentState.error = typeof action.payload === "string" ? action.payload : "Unknown error";
			})
	}
});

export default friendSlice.reducer;
export const friendActions = friendSlice.actions;
