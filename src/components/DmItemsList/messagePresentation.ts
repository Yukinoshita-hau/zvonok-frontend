import type { ShortMessage } from "../../entities/shortMessage";
import { isSameDay } from "../../utils/timeHelpers";

export const MESSAGE_GROUP_INTERVAL_MS = 5 * 60 * 1000;
export function isMessageContinuation(
	previous: ShortMessage | null,
	current: ShortMessage,
	unreadId: number | null = null,
) {
	const gap = previous
		? Date.parse(current.sentAt) - Date.parse(previous.sentAt)
		: NaN;
	if (!Number.isFinite(gap)) return false;
	if (
		!previous ||
		current.id === unreadId ||
		current.senderId !== previous.senderId ||
		current.room.id !== previous.room.id ||
		current.replyToMessageId !== null ||
		previous.replyToMessageId !== null ||
		current.type === "SYSTEM" ||
		current.type === "JOIN" ||
		previous.type === "SYSTEM" ||
		previous.type === "JOIN" ||
		current.eventType === "MESSAGE_DELETE" ||
		previous.eventType === "MESSAGE_DELETE" ||
		!isSameDay(previous.sentAt, current.sentAt)
	)
		return false;
	return gap >= 0 && gap <= MESSAGE_GROUP_INTERVAL_MS;
}
export function shouldSubmitMessage(event: {
	key: string;
	shiftKey: boolean;
	isComposing: boolean;
	keyCode?: number;
}) {
	return (
		event.key === "Enter" &&
		!event.shiftKey &&
		!event.isComposing &&
		event.keyCode !== 229
	);
}
