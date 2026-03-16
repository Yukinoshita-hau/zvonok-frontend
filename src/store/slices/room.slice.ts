import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import type { Room } from "../../entities/room";
import { roomApi } from "../../api/roomApi";
import type { CreateGroupBody } from "../../api/interfaces/CreateGroupBody";

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

export const createGroupRoom = createAsyncThunk(
	"room/createGroup",
	async (body: CreateGroupBody, thunkAPI) => {
		try {
			const { data } = await roomApi.createGroup(body);
			return data;
		} catch (e: any) {
			return thunkAPI.rejectWithValue(e?.message ?? "Failed to create group room");
		}
	}
)

export const markRoomRead = createAsyncThunk(
	"room/markRoomRead",
	async (params: { roomId: number }, thunkAPI) => {
		try {
			await roomApi.markRoomRead(params);
			return params;
		} catch (e: any) {
			return thunkAPI.rejectWithValue(e?.message ?? "Failed to mark room");
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


			.addCase(markRoomRead.fulfilled, (currentState, action) => {
				const roomId = action.payload.roomId;

				const room = currentState.rooms.find(r => r.id === roomId);
				if (room) {
					room.firstUnreadMessageId = null;
					room.unreadCount = 0;
				}
			})
	}
});

export default roomSlice.reducer;
export const roomActions = roomSlice.actions;
