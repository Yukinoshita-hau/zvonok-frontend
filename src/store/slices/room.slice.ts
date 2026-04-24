import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import type { CreateGroupBody } from "../../api/interfaces/CreateGroupBody";
import { roomApi } from "../../api/roomApi";
import type { Room, RoomApiResponse } from "../../entities/room";
import type { UserShort } from "../../entities/userShort";
import { usersActions } from "./users.slice";

export interface RoomState {
	rooms: Room[];
	status: "idle" | "loading" | "succeeded" | "failed";
	error: string | null;
}

interface FetchRoomsNormalized {
	rooms: Room[];
	users: UserShort[];
}

const initialState: RoomState = {
	rooms: [],
	status: "idle",
	error: null,
};

const normalizeRooms = (rooms: RoomApiResponse[]): FetchRoomsNormalized => {
	const usersById: Record<number, UserShort> = {};

	const normalizedRooms: Room[] = rooms.map((room) => {
		room.members.forEach((member) => {
			usersById[member.id] = {
				...usersById[member.id],
				...member,
			};
		});

		return {
			id: room.id,
			name: room.name,
			type: room.type,
			avatarUrl: room.avatarUrl,
			isActive: room.isActive,
			createdAt: room.createdAt,
			lastMessageId: room.lastMessageId,
			lastMessageContent: room.lastMessageContent,
			lastActivityAt: room.lastActivityAt,
			unreadCount: room.unreadCount,
			firstUnreadMessageId: room.firstUnreadMessageId,
			memberIds: room.members.map((member) => member.id),
		};
	});

	return {
		rooms: normalizedRooms,
		users: Object.values(usersById),
	};
};

export const fetchMyRooms = createAsyncThunk(
	"room/fetchMyRooms",
	async (_, thunkAPI) => {
		try {
			const { data } = await roomApi.myRooms();
			const normalized = normalizeRooms(data);
			thunkAPI.dispatch(usersActions.upsertUsers(normalized.users));
			return normalized;
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : "Failed to load rooms";
			return thunkAPI.rejectWithValue(message);
		}
	}
);

export const createGroupRoom = createAsyncThunk(
	"room/createGroup",
	async (body: CreateGroupBody, thunkAPI) => {
		try {
			const { data } = await roomApi.createGroup(body);
			return data;
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : "Failed to create group room";
			return thunkAPI.rejectWithValue(message);
		}
	}
);

export const markRoomAsRead = createAsyncThunk(
	"room/markRoomAsRead",
	async (body: { roomId: number }, thunkAPI) => {
		try {
			await roomApi.markRoomRead({ roomId: body.roomId });
			return body.roomId;
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : "Failed to mark room";
			return thunkAPI.rejectWithValue(message);
		}
	}
);

export const roomSlice = createSlice({
	name: "room",
	initialState,
	reducers: {},
	extraReducers: (builder) => {
		builder
			.addCase(fetchMyRooms.pending, (currentState) => {
				currentState.status = "loading";
				currentState.error = null;
			})
			.addCase(fetchMyRooms.fulfilled, (currentState, action) => {
				currentState.status = "succeeded";
				currentState.rooms = action.payload.rooms;
			})
			.addCase(fetchMyRooms.rejected, (currentState, action) => {
				currentState.status = "failed";
				currentState.error = typeof action.payload === "string" ? action.payload : "Unknown error";
			})

			.addCase(markRoomAsRead.fulfilled, (currentState, action) => {
				const room = currentState.rooms.find((r) => r.id === action.payload);
				if (room !== undefined) room.unreadCount = 0;
			});
	},
});

export default roomSlice.reducer;
export const roomActions = roomSlice.actions;
