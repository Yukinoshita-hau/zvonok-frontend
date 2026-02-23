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
