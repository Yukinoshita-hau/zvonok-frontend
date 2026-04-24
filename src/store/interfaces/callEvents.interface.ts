import type { callType } from "./call.types";

export interface BaseCallEvent {
	type: callType;
	chatRoomId: number;
	timestamp: string;
}

export interface CallInviteEvent extends BaseCallEvent {
	callType: "audio" | "video";
	fromUser: string;
	liveKitRoomName: string;
}
export interface CallAcceptEvent extends BaseCallEvent {
	toUsers: string;
	liveKitRoomName: string;
}

export interface CallDeclineEvent extends BaseCallEvent {
	fromUser: string;
}

export interface CallBusyEvent extends BaseCallEvent { }
export interface CallEndEvent extends BaseCallEvent { }	
