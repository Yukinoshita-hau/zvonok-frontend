import type { CallSessionStatus } from "../../entities/callSession";
import type { RoomType } from "../../entities/room";
import type { CallParticipantStatus } from "./CallParticipantResponse";

export type CallRestoreType = "NONE" | "INCOMING_CALL" | "ACTIVE_CALL";

export interface RestoreCallSessionResponse {
	callRestoreType: CallRestoreType;
	restorable: boolean;
	callId: number | null;
	chatRoomId: number | null;
	roomId: number | null;
	roomType: RoomType;
	callStatus: CallSessionStatus;
	hostUsername: string;
	participantStatus: CallParticipantStatus;
	liveKitRoomName: string | null;
	serverUrl: string | null;
	participantToken: string | null;
	expiresAt: string | null;
}
