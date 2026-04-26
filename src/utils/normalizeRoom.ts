import type { Room, RoomResponse } from "../entities/room";
import type { UserMini } from "../entities/user";

export function normalizeRoom(roomResponse: RoomResponse): {
	room: Room;
	users: UserMini[];
} {
	return {
		room: {
			id: roomResponse.id,
			name: roomResponse.name,
			type: roomResponse.type,
			avatarUrl: roomResponse.avatarUrl,
			isActive: roomResponse.isActive,
			createdAt: roomResponse.createdAt,
			lastMessageId: roomResponse.lastMessageId,
			lastMessageContent: roomResponse.lastMessageContent,
			lastActivityAt: roomResponse.lastActivityAt,
			unreadCount: roomResponse.unreadCount,
			firstUnreadMessageId: roomResponse.firstUnreadMessageId,
			memberIds: roomResponse.members.map((member) => member.id),
		},
		users: roomResponse.members,
	};
}

export function normalizeRooms(roomResponses: RoomResponse[]): {
	rooms: Room[];
	users: UserMini[];
} {
	const rooms: Room[] = [];
	const usersById = new Map<number, UserMini>();

	for (const roomResponse of roomResponses) {
		const normalized = normalizeRoom(roomResponse);

		rooms.push(normalized.room);

		for (const user of normalized.users) {
			usersById.set(user.id, user);
		}
	}

	return {
		rooms,
		users: Array.from(usersById.values()),
	};
}
