import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import type { Room } from "../../entities/room";
import { roomApi } from "../../api/roomApi";

export interface RoomState {
	rooms: Room[];
	status: "idle" | "loading" | "succeeded" | "failed";
	error: string | null;
}

const initialState: RoomState = {
	rooms: [],
	status: "idle",
	error: null,
};

export const fetchMyRooms = createAsyncThunk(
	"room/fetchMyRooms",
	async (_, thunkAPI) => {
		try {
			const { data } = await roomApi.myRooms();
			return data;
		} catch (e: any) {
			return thunkAPI.rejectWithValue(e?.message ?? "Failed to load rooms");
		}
	}
)

export const roomSlice = createSlice({
	name: "room",
	initialState: initialState,
	reducers: {},
	extraReducers: builder => {
		builder
			.addCase(fetchMyRooms.pending, currentState => {
				currentState.status = "loading";
				currentState.error = null;
			})
			.addCase(fetchMyRooms.fulfilled, (currentState, action) => {
				currentState.status = "succeeded";
				currentState.rooms = action.payload;
			})
			.addCase(fetchMyRooms.rejected, (currentState, action) => {
				currentState.status = "failed";
				currentState.error = typeof action.payload === "string" ? action.payload : "Unknown error";
			})
	}
});

export default roomSlice.reducer;
export const roomActions = roomSlice.actions;
