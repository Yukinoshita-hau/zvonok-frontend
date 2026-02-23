import type { RoomMembers } from "./roomMember";

export type RoomType = "GROUP" | "PRIVATE";

export interface Room {
	id: number;
	name: string;
	type: RoomType;
	isActive: boolean;
	createdAt: string;
	lastMessageId: number | null;
	lastMessageContent: string | null;
	lastActivityAt: string | null;
	members: RoomMembers[]
}
