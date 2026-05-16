import type { CallSessionStatus } from "../../entities/callSession";
import type { RoomType } from "../../entities/room";
import type { CallParticipantStatus } from "./CallParticipantResponse";

export interface RestoreCallSessionResponse {
	restorable: boolean;
	callId: number | null;
	chatRoomId: number | null;
	roomId: number | null;
	roomType: RoomType;
	callStatus: CallSessionStatus;
	participantStatus: CallParticipantStatus;
	liveKitRoomName: string | null;
	serverUrl: string | null;
	participantToken: string | null;
	expiresAt: string | null;
}
