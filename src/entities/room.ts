import type { RoomMemberShort } from "./roomMember";

export type RoomType = "GROUP" | "PRIVATE";

export interface RoomApiResponse {
	id: number;
	name: string;
	type: RoomType;
	avatarUrl: string;
	isActive: boolean;
	createdAt: string;
	lastMessageId: number | null;
	lastMessageContent: string | null;
	lastActivityAt: string | null;
	unreadCount: number;
	firstUnreadMessageId: number;
	members: RoomMemberShort[];
}

export interface RoomStateItem {
	id: number;
	name: string;
	type: RoomType;
	avatarUrl: string;
	isActive: boolean;
	createdAt: string;
	lastMessageId: number | null;
	lastMessageContent: string | null;
	lastActivityAt: string | null;
	unreadCount: number;
	firstUnreadMessageId: number;
	memberIds: number[];
}

export type Room = RoomStateItem;
