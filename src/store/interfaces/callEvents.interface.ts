import type { CallEventType, CallRoomType } from "./call.types";

export interface BaseCallEvent {
	type: CallEventType;
	eventId?: string;
	callId?: number;
	chatRoomId?: number;
	roomId?: number;
	roomType?: CallRoomType;
	liveKitRoomName?: string;
	livekitRoomName?: string;
	callerUsername?: string;
	hostUsername?: string;
	participantUsername?: string;
	callType?: "audio" | "video" | string;
	occurredAt?: string;
	timestamp?: string;
	callStatus?: "RINGING" | "ACTIVE" | "ENDED";
	participantStatus?: "RINGING" | "ACCEPTED" | "JOINED" | "DECLINED" | "LEFT";
	endReason?: string | null;
	participantsCount?: number;
	callRoomType?: CallRoomType;
	fromUser?: string;
}

export interface CallInviteEvent extends BaseCallEvent {
	type: "CALL_INVITE";
}

export interface CallStartedEvent extends BaseCallEvent {
	type: "CALL_STARTED";
}
