import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { Room, RoomResponse } from "../../entities/room";
import { roomApi } from "../../api/roomApi";
import type { CreateGroupBody } from "../../api/interfaces/CreateGroupBody";
import { normalizeRoom, normalizeRooms } from "../../utils/normalizeRoom";
import { usersActions } from "./users.slice";
import type { AppDispatch } from "../store";
import type { AddRoomMembersResponse } from "../../api/interfaces/RoomManagementDtos";
import type { UserMini } from "../../entities/UserMini";

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

export const addRoomMembers = createAsyncThunk<
	{
		roomId: number;
		addedMembers: UserMini[];
		skippedUserIds: number[];
		room?: Room;
	},
	{
		roomId: number;
		userIds: number[];
	},
	{
		dispatch: AppDispatch;
		rejectValue: string;
	}
>(
	"room/addMembers",
	async ({ roomId, userIds }, thunkAPI) => {
		try {
			const { data } = await roomApi.addRoomMembers(roomId, { userIds });
			const response = data as AddRoomMembersResponse;
			const addedMembers = response.addedMembers ?? [];

			if (response.room) {
				const { room, users } = normalizeRoom(response.room);
				thunkAPI.dispatch(usersActions.upsertUsers(users));

				return {
					roomId,
					addedMembers,
					skippedUserIds: response.skippedUserIds ?? [],
					room,
				};
			}

			thunkAPI.dispatch(usersActions.upsertUsers(addedMembers));

			return {
				roomId,
				addedMembers,
				skippedUserIds: response.skippedUserIds ?? [],
			};
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : "Failed to add room members";
			return thunkAPI.rejectWithValue(message);
		}
	}
);

export const leaveRoom = createAsyncThunk<
	number,
	{ roomId: number },
	{
		rejectValue: string;
	}
>(
	"room/leaveRoom",
	async ({ roomId }, thunkAPI) => {
		try {
			await roomApi.leaveRoom(roomId);
			return roomId;
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : "Failed to leave room";
			return thunkAPI.rejectWithValue(message);
		}
	}
);

export const roomSlice = createSlice({
	name: "room",
	initialState,
	reducers: {
		clearRoomMessagesState: (state, action: PayloadAction<{ roomId: number }>) => {
			const room = state.rooms.find((item) => item.id === action.payload.roomId);
			if (!room) return;

			room.lastMessageId = null;
			room.lastMessageContent = null;
			room.unreadCount = 0;
			room.firstUnreadMessageId = null;
		},

		upsertRoom: (state, action: PayloadAction<Room>) => {
			const index = state.rooms.findIndex((room) => room.id === action.payload.id);

			if (index === -1) {
				state.rooms.unshift(action.payload);
				return;
			}

			state.rooms[index] = action.payload;
		},

		removeRoomState: (state, action: PayloadAction<{ roomId: number }>) => {
			state.rooms = state.rooms.filter((room) => room.id !== action.payload.roomId);
		},

		removeMemberFromRoomState: (
			state,
			action: PayloadAction<{
				roomId: number;
				userId: number;
			}>
		) => {
			const room = state.rooms.find((item) => item.id === action.payload.roomId);
			if (!room) return;

			room.memberIds = room.memberIds.filter((memberId) => memberId !== action.payload.userId);
		},

		addMembersToRoomState: (
			state,
			action: PayloadAction<{
				roomId: number;
				memberIds: number[];
			}>
		) => {
			const room = state.rooms.find((item) => item.id === action.payload.roomId);
			if (!room) return;

			for (const memberId of action.payload.memberIds) {
				if (!room.memberIds.includes(memberId)) {
					room.memberIds.push(memberId);
				}
			}
		},
	},
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
			})

			.addCase(addRoomMembers.fulfilled, (state, action) => {
				if (action.payload.room) {
					const roomIndex = state.rooms.findIndex(
						(room) => room.id === action.payload.room?.id
					);

					if (roomIndex === -1) {
						state.rooms.unshift(action.payload.room);
					} else {
						state.rooms[roomIndex] = action.payload.room;
					}

					return;
				}

				const room = state.rooms.find((item) => item.id === action.payload.roomId);
				if (!room) return;

				for (const member of action.payload.addedMembers) {
					if (!room.memberIds.includes(member.id)) {
						room.memberIds.push(member.id);
					}
				}
			})

			.addCase(leaveRoom.fulfilled, (state, action) => {
				state.rooms = state.rooms.filter((room) => room.id !== action.payload);
			});
	}
});

export default roomSlice.reducer;
export const roomActions = roomSlice.actions;
