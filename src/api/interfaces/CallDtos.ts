import type { RoomType } from "../../entities/room";
import type { CallParticipantStatus } from "./CallParticipantResponse";
import type { CallSessionStatus } from "../../entities/callSession";

export interface JoinCallDto {
	callId?: number | null;
	chatRoomId?: number | null;
}

export interface AcceptCallDto {
	callId?: number | null;
	chatRoomId?: number | null;
}

export interface DeclineCallDto {
	callId?: number | null;
	chatRoomId?: number | null;
}

export interface LeaveCallDto {
	callId?: number | null;
	chatRoomId?: number | null;
}

export interface EndCallDto {
	callId?: number | null;
	chatRoomId?: number | null;
}

export type { CallParticipantStatus, CallSessionStatus, RoomType };
