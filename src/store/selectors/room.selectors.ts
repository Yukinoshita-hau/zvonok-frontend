import type { RootState } from "../store";

export const selectRoomById = (state: RootState, roomId: number) => {
	return state.room.rooms.find(room => room.id === roomId);
};

export const selectRoomMembers = (state: RootState, roomId: number) => {
	const room = selectRoomById(state, roomId);

	if (!room) {
		return [];
	}

	return room.memberIds
		.map(userId => state.users.byId[userId])
		.filter(Boolean);
};
