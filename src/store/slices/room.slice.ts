import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import type { Room, RoomResponse } from "../../entities/room";
import { roomApi } from "../../api/roomApi";
import type { CreateGroupBody } from "../../api/interfaces/CreateGroupBody";
import { normalizeRoom, normalizeRooms } from "../../utils/normalizeRoom";
import { usersActions } from "./users.slice";
import type { AppDispatch } from "../store";

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

export const fetchMyRooms = createAsyncThunk<
	Room[],
	void,
	{
		dispatch: AppDispatch;
		rejectValue: string;
	}
>(
	"room/fetchMyRooms",
	async (_, thunkAPI) => {
		try {
			const { data } = await roomApi.myRooms();

			const { rooms, users } = normalizeRooms(data as RoomResponse[]);

			thunkAPI.dispatch(usersActions.upsertUsers(users));

			return rooms;
		} catch (e: any) {
			return thunkAPI.rejectWithValue(e?.message ?? "Failed to load rooms");
		}
	}
);

export const createGroupRoom = createAsyncThunk<
	Room,
	CreateGroupBody,
	{
		dispatch: AppDispatch;
		rejectValue: string;
	}
>(
	"room/createGroup",
	async (body, thunkAPI) => {
		try {
			const { data } = await roomApi.createGroup(body);

			const { room, users } = normalizeRoom(data);

			thunkAPI.dispatch(usersActions.upsertUsers(users));

			return room;
		} catch (e: any) {
			return thunkAPI.rejectWithValue(e?.message ?? "Failed to create group room");
		}
	}
);

export const markRoomAsRead = createAsyncThunk<
	number,
	{ roomId: number },
	{
		rejectValue: string;
	}
>(
	"room/markRoomAsRead",
	async (body, thunkAPI) => {
		try {
			await roomApi.markRoomRead({ roomId: body.roomId });
			return body.roomId;
		} catch (e: any) {
			return thunkAPI.rejectWithValue(e?.message ?? "Failed to mark room");
		}
	}
);

export const roomSlice = createSlice({
	name: "room",
	initialState,
	reducers: {},
	extraReducers: builder => {
		builder
			.addCase(fetchMyRooms.pending, state => {
				state.status = "loading";
				state.error = null;
			})
			.addCase(fetchMyRooms.fulfilled, (state, action) => {
				state.status = "succeeded";
				state.rooms = action.payload;
			})
			.addCase(fetchMyRooms.rejected, (state, action) => {
				state.status = "failed";
				state.error = action.payload ?? "Unknown error";
			})

			.addCase(createGroupRoom.fulfilled, (state, action) => {
				const createdRoom = action.payload;

				const existingIndex = state.rooms.findIndex(
					room => room.id === createdRoom.id
				);

				if (existingIndex === -1) {
					state.rooms.unshift(createdRoom);
				} else {
					state.rooms[existingIndex] = createdRoom;
				}
			})

			.addCase(markRoomAsRead.fulfilled, (state, action) => {
				const room = state.rooms.find(r => r.id === action.payload);

				if (room) {
					room.unreadCount = 0;
					room.firstUnreadMessageId = null;
				}
			});
	}
});

export default roomSlice.reducer;
export const roomActions = roomSlice.actions;
