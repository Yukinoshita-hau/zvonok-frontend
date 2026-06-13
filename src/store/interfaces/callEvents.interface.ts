import type { CallEventType, CallRoomType } from "./call.types";

export interface BaseCallEvent {
	type: CallEventType;
	eventId?: string;
	callId?: number;
	chatRoomId?: number;
	roomId?: number;
	roomType?: CallRoomType;
	liveKitRoomName?: string;
	callerUsername?: string;
	hostUsername?: string;
	participantUsername?: string;
	callType?: "audio" | "video" | string;
	occurredAt?: string;
	timestamp?: string;
	callStatus?: string;
	participantStatus?: string;
	fromUser?: string;
}

export interface CallInviteEvent extends BaseCallEvent {
	type: "CALL_INVITE";
}

export interface CallStartedEvent extends BaseCallEvent {
	type: "CALL_STARTED";
}
