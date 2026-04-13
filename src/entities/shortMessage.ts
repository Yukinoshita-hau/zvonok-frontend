import type { MessageType } from "./interfaces/MessageType"
import type { UserStatus } from "./interfaces/UserStatus";
import type { RoomType } from "./room";

export interface ShortMessageSender {
	id: number;
	username: string;
	avatarUrl: string | null;
	status: UserStatus
}

export interface ShortMessageRoom {
	id: number;
	type: RoomType
}

export type EventType = "MESSAGE" | "MESSAGE_EDIT" | "MESSAGE_DELETE";

export interface ShortMessage {
	id: number;
	content: string;
	type: MessageType;
	eventType: EventType;
	sentAt: string;
	sender: ShortMessageSender;
	room: ShortMessageRoom;
	editedAt: string;
	readBy?: string[];
}
