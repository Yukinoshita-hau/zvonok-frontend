import type { MessageType } from "./interfaces/MessageType";
import type { UserMini } from "./user";
import type { RoomType } from "./room";

export interface ShortMessageRoom {
	id: number;
	type: RoomType;
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

/**
 * backend.
 */
export interface ShortMessageResponse {
	id: number;
	content: string;
	type: MessageType;
	eventType: EventType;
	sentAt: string;
	sender: UserMini;
	room: ShortMessageRoom;
	editedAt: string | null;
	replyToMessageId: number | null;
	replyPreview: ReplyPreviewDto | null;
	readBy?: string[];
}

/**
 *  Redux.
 */
export interface ShortMessage {
	id: number;
	content: string;
	type: MessageType;
	eventType: EventType;
	sentAt: string;
	senderId: number;
	room: ShortMessageRoom;
	editedAt: string | null;
	replyToMessageId: number | null;
	replyPreview: ReplyPreviewDto | null;
	readBy?: string[];
}
