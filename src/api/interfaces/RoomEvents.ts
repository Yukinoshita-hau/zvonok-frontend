export type RoomEventsType =
	"ROOM_CREATED" |
	"ROOM_UPDATE" |
	"ROOM_DELETED" |
	"ROOM_MESSAGES_CLEARED" |
	"ROOM_MEMBERS_ADDED" |
	"ROOM_MEMBER_LEFT";

export interface RoomMemberLeftPayload {
	roomId: number;
	userId: number;
	username?: string | null;
	avatarUrl?: string | null;
	leftAt?: string | null;
}

export interface RoomEvents {
	type: RoomEventsType;
	roomId?: number;
	room?: unknown;
	members?: unknown[];
	payload?: RoomMemberLeftPayload;
}
