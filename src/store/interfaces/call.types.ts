export type CallEventType =
	| "CALL_INVITE"
	| "CALL_STARTED"
	| "CALL_ACCEPT"
	| "CALL_ACCEPTED"
	| "CALL_DECLINE"
	| "CALL_DECLINED"
	| "CALL_BUSY"
	| "CALL_END"
	| "CALL_ENDED"
	| "CALL_CANCELLED"
	| "CALL_PARTICIPANT_JOINED"
	| "CALL_PARTICIPANT_DECLINED"
	| "CALL_PARTICIPANT_LEFT"
	| "CALL_ERROR";

export type callStatus = "idle" | "outgoing_ringing" | "incoming_ringing" | "connecting" | "in_call" | "ended" | "error";

export type CallRoomType = "PRIVATE" | "GROUP";
