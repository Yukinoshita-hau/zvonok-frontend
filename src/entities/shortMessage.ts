import type { MessageType } from "./interfaces/MessageType"
import type { UserStatus } from "./interfaces/UserStatus";
import type { RoomType } from "./room";

export interface ShortMessageSender {
	id: number;
	username: string;
	displayName: string;
	avatarUrl: string | null;
	status: UserStatus
}

export interface ShortMessageRoom {
	id: number;
	type: RoomType
}

export type EventType = "MESSAGE" | "MESSAGE_EDIT" | "MESSAGE_DELETE";

export interface ReplyPreviewDto {
	id: number;
	authorId: number;
	authorUsername: string;
	authorDisplayName: string;
	snippet: string;
	type: MessageType;
	deleted: boolean;
}

export interface ShortMessage {
	id: number;
	content: string;
	type: MessageType;
	eventType: EventType;
	sentAt: string;
	sender: ShortMessageSender;
	room: ShortMessageRoom;
	editedAt: string;
	replyToMessageId: number | null;
	replyPreview: ReplyPreviewDto | null
	readBy?: string[];
}
