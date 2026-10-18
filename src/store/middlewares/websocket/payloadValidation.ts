import type { UserProfileUpdate } from "../../../api/interfaces/UserProfileUpdatedEvent";
import type { BaseCallEvent } from "../../interfaces/callEvents.interface";
import type { UserMini } from "../../../entities/UserMini";
import type { RoomResponse } from "../../../entities/room";
import type { ShortMessageResponse } from "../../../entities/shortMessage";
import type { MessageAttachment } from "../../../api/interfaces/MessageAttachmentDtos";

export function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}
const id = (value: unknown) =>
	typeof value === "number" && Number.isSafeInteger(value) && value > 0;
const nullableString = (value: unknown) => value === null || typeof value === "string";
const optional = (value: unknown, check: (v: unknown) => boolean) =>
	value === undefined || check(value);
const nullableId = (value: unknown) => value === null || id(value);
const oneOf = (value: unknown, values: readonly string[]) =>
	typeof value === "string" && values.includes(value);

export function parseObject(body: string): Record<string, unknown> | null {
	try {
		const value: unknown = JSON.parse(body);
		return isRecord(value) ? value : null;
	} catch {
		return null;
	}
}
export function isUserMini(value: unknown): value is UserMini {
	return (
		isRecord(value) &&
		id(value.id) &&
		typeof value.username === "string" &&
		typeof value.displayName === "string" &&
		oneOf(value.status, ["ONLINE", "OFFLINE", "AWAY", "BUSY", "INVISIBLE"]) &&
		nullableString(value.avatarUrl) &&
		nullableString(value.lastSeenAt) &&
		typeof value.createdAt === "string" &&
		typeof value.updatedAt === "string"
	);
}
export function isRoomResponse(value: unknown): value is RoomResponse {
	return (
		isRecord(value) &&
		id(value.id) &&
		nullableString(value.name) &&
		oneOf(value.type, ["PRIVATE", "GROUP"]) &&
		nullableString(value.avatarUrl) &&
		typeof value.isActive === "boolean" &&
		typeof value.createdAt === "string" &&
		nullableId(value.lastMessageId) &&
		nullableId(value.firstUnreadMessageId) &&
		nullableString(value.lastMessageContent) &&
		nullableString(value.lastActivityAt) &&
		typeof value.unreadCount === "number" &&
		Number.isSafeInteger(value.unreadCount) &&
		value.unreadCount >= 0 &&
		Array.isArray(value.members) &&
		value.members.every(isUserMini)
	);
}
function isAttachment(value: unknown): value is MessageAttachment {
	return (
		isRecord(value) &&
		id(value.id) &&
		oneOf(value.type, ["IMAGE", "VIDEO", "AUDIO", "VIDEO_NOTE"]) &&
		typeof value.originalFileName === "string" &&
		typeof value.contentType === "string" &&
		typeof value.sizeBytes === "number" &&
		Number.isFinite(value.sizeBytes) &&
		value.sizeBytes >= 0 &&
		[value.url, value.downloadUrl, value.waveform].every((v) => optional(v, nullableString)) &&
		[value.width, value.height, value.durationMs].every((v) =>
			optional(v, (n) => n === null || (typeof n === "number" && Number.isFinite(n))),
		)
	);
}
function isMessageSender(value: unknown): boolean {
	return (
		isRecord(value) &&
		id(value.id) &&
		typeof value.username === "string" &&
		typeof value.displayName === "string" &&
		nullableString(value.avatarUrl) &&
		oneOf(value.status, ["ONLINE", "OFFLINE", "AWAY", "BUSY", "INVISIBLE"])
	);
}
export function isMessage(value: unknown): value is ShortMessageResponse {
	if (!isRecord(value)) return false;
	const reply = value.replyPreview;
	return (
		id(value.id) &&
		nullableString(value.content) &&
		oneOf(value.type, ["DEFAULT", "SYSTEM", "JOIN", "REPLY", "IMAGE", "FILE"]) &&
		oneOf(value.eventType, ["MESSAGE", "MESSAGE_EDIT", "MESSAGE_DELETE"]) &&
		typeof value.sentAt === "string" &&
		nullableString(value.editedAt) &&
		nullableId(value.replyToMessageId) &&
		isMessageSender(value.sender) &&
		isRecord(value.room) &&
		id(value.room.id) &&
		oneOf(value.room.type, ["PRIVATE", "GROUP"]) &&
		(reply === null ||
			(isRecord(reply) &&
				id(reply.id) &&
				id(reply.authorId) &&
				typeof reply.authorUsername === "string" &&
				typeof reply.authorDisplayName === "string" &&
				typeof reply.snippet === "string" &&
				typeof reply.deleted === "boolean" &&
				oneOf(reply.type, ["DEFAULT", "SYSTEM", "JOIN", "REPLY", "IMAGE", "FILE"]))) &&
		optional(value.readBy, (v) => Array.isArray(v) && v.every((n) => typeof n === "string")) &&
		optional(value.attachments, (v) => v === null || (Array.isArray(v) && v.every(isAttachment)))
	);
}
export function isCallEvent(value: unknown): value is BaseCallEvent {
	if (!isRecord(value)) return false;
	return (
		oneOf(value.type, [
			"CALL_INVITE",
			"CALL_STARTED",
			"CALL_ACCEPT",
			"CALL_ACCEPTED",
			"CALL_DECLINE",
			"CALL_DECLINED",
			"CALL_BUSY",
			"CALL_END",
			"CALL_ENDED",
			"CALL_CANCELLED",
			"CALL_PARTICIPANT_JOINED",
			"CALL_PARTICIPANT_DECLINED",
			"CALL_PARTICIPANT_LEFT",
			"CALL_ERROR",
		]) &&
		[value.callId, value.chatRoomId, value.roomId].every((v) => optional(v, id)) &&
		[
			value.eventId,
			value.liveKitRoomName,
			value.livekitRoomName,
			value.callerUsername,
			value.hostUsername,
			value.participantUsername,
			value.callType,
			value.occurredAt,
			value.timestamp,
			value.fromUser,
		].every((v) => optional(v, (n) => typeof n === "string")) &&
		optional(value.endReason, nullableString) &&
		optional(
			value.participantsCount,
			(n) => typeof n === "number" && Number.isSafeInteger(n) && n >= 0,
		) &&
		[value.roomType, value.callRoomType].every((v) =>
			optional(v, (n) => oneOf(n, ["PRIVATE", "GROUP"])),
		) &&
		optional(value.callStatus, (n) => oneOf(n, ["RINGING", "ACTIVE", "ENDED"])) &&
		optional(value.participantStatus, (n) =>
			oneOf(n, ["RINGING", "ACCEPTED", "JOINED", "DECLINED", "LEFT"]),
		)
	);
}

export interface FriendNotificationPayload {
	senderUsername: string;
	receiverUsername: string;
	senderId: number;
	receiverId: number;
	senderDisplayName: string | null;
	receiverDisplayName: string | null;
}
export function isFriendNotificationPayload(v: unknown): v is FriendNotificationPayload {
	return (
		isRecord(v) &&
		typeof v.senderUsername === "string" &&
		typeof v.receiverUsername === "string" &&
		id(v.senderId) &&
		id(v.receiverId) &&
		nullableString(v.senderDisplayName) &&
		nullableString(v.receiverDisplayName)
	);
}

export function isUserProfileUpdate(value: unknown): value is UserProfileUpdate {
	return (
		isRecord(value) &&
		id(value.id) &&
		typeof value.username === "string" &&
		typeof value.displayName === "string" &&
		nullableString(value.avatarUrl) &&
		nullableString(value.aboutMe)
	);
}
