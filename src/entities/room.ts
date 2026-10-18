import type { UserMini } from "./UserMini";

export type RoomType = "GROUP" | "PRIVATE";

export interface RoomResponse {
	id: number;
	name: string | null;
	type: RoomType;
	avatarUrl: string | null;
	isActive: boolean;
	createdAt: string;
	lastMessageId: number | null;
	lastMessageContent: string | null;
	lastActivityAt: string | null;
	unreadCount: number;
	firstUnreadMessageId: number | null;
	members: UserMini[];
}

export interface Room {
	id: number;
	name: string | null;
	type: RoomType;
	avatarUrl: string | null;
	isActive: boolean;
	createdAt: string;
	lastMessageId: number | null;
	lastMessageContent: string | null;
	lastActivityAt: string | null;
	unreadCount: number;
	firstUnreadMessageId: number | null;
	memberIds: number[];
}
