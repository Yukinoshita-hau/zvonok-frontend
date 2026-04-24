import { createSelector } from "@reduxjs/toolkit";
import type { Room } from "../../entities/room";
import type { RoomMemberShort } from "../../entities/roomMember";
import type { RootState } from "../store";

export const selectUsersById = (state: RootState) => state.users.usersById;
export const selectRooms = (state: RootState) => state.room.rooms;

export const selectRoomById = (state: RootState, roomId: number) =>
	state.room.rooms.find((room) => room.id === roomId) ?? null;

const selectRoomForMembers = (_state: RootState, room: Room | null) => room;

export const selectMembersFromRoom = createSelector(
	[selectUsersById, selectRoomForMembers],
	(usersById, room): RoomMemberShort[] => {
		if (!room) return [];
		return room.memberIds
			.map((memberId) => usersById[memberId])
			.filter((member): member is RoomMemberShort => member !== undefined);
	}
);

export const selectRoomMembers = createSelector(
	[selectRoomById, selectUsersById],
	(room, usersById): RoomMemberShort[] => {
		if (!room) return [];
		return room.memberIds
			.map((memberId) => usersById[memberId])
			.filter((member): member is RoomMemberShort => member !== undefined);
	}
);

export const selectRoomsWithMembers = createSelector(
	[selectRooms, selectUsersById],
	(rooms, usersById) =>
		rooms.map((room) => ({
			...room,
			members: room.memberIds
				.map((memberId) => usersById[memberId])
				.filter((member): member is RoomMemberShort => member !== undefined),
		}))
);
