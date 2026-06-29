import type { ShortMessage, ShortMessageResponse } from "../entities/shortMessage";
import type { UserMini } from "../entities/UserMini";

export function normalizeMessage(messageResponse: ShortMessageResponse): {
	message: ShortMessage;
	user: UserMini;
} {
	return {
		message: {
			id: messageResponse.id,
			content: messageResponse.content ?? "",
			type: messageResponse.type,
			eventType: messageResponse.eventType,
			sentAt: messageResponse.sentAt,
			senderId: messageResponse.sender.id,
			room: messageResponse.room,
			editedAt: messageResponse.editedAt,
			replyToMessageId: messageResponse.replyToMessageId,
			replyPreview: messageResponse.replyPreview,
			readBy: messageResponse.readBy,
			attachments: messageResponse.attachments ?? [],
		},
		user: messageResponse.sender,
	};
}

export function normalizeMessages(messageResponses: ShortMessageResponse[]): {
	messages: ShortMessage[];
	users: UserMini[];
} {
	const messages: ShortMessage[] = [];
	const usersById = new Map<number, UserMini>();

	for (const messageResponse of messageResponses) {
		const normalized = normalizeMessage(messageResponse);

		messages.push(normalized.message);
		usersById.set(normalized.user.id, normalized.user);
	}

	return {
		messages,
		users: Array.from(usersById.values()),
	};
}
