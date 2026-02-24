import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import type { Friend } from "../../entities/friend";
import { friendApi } from "../../api/friendApi";

export interface FriendState {
	friends: Friend[];
	status: "idle" | "loading" | "succeeded" | "failed";
	error: string | null;
}

const initialState: FriendState = {
	friends: [],
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

export const sendFriendRequest = createAsyncThunk(
	"friend/sendRequest",
	async (username: string, thunkAPI) => {
		try {
			const { data } = await friendApi.sendRequest(username);
			return data;
		} catch (e: any) {
			return thunkAPI.rejectWithValue(e?.message ?? "Failed to send request");
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
	reducers: {},
	extraReducers: builder => {
		builder
			.addCase(fetchMyFriends.pending, currentState => {
				currentState.status = "loading";
				currentState.error = null;
			})
			.addCase(fetchMyFriends.fulfilled, (currentState, action) => {
				currentState.status = "succeeded";
				currentState.friends = action.payload;
			})
			.addCase(fetchMyFriends.rejected, (currentState, action) => {
				currentState.status = "failed";
				currentState.error = typeof action.payload === "string" ? action.payload : "Unknown error";
			})
	}
});

export default friendSlice.reducer;
export const messageActions = friendSlice.actions;
