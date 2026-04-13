import type { MessageType } from "./interfaces/MessageType";
import type { UserStatus } from "./interfaces/UserStatus";
import type { EventType } from "./shortMessage";

export interface ChannelMessageSender {
	id: number;
	username: string;
	avatarUrl: string | null;
	status: UserStatus;
}

export interface ChannelMessageChannel {
	id: number;
	name: string;
}

export interface ChannelMessage {
	id: number;
	content: string;
	channelId: number;
	type: MessageType;
	eventType: EventType;
	sentAt: string;
	editedAt: string | null;
	sender: ChannelMessageSender;
}
