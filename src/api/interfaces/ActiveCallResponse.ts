import type { CallSessionStatus } from "../../entities/callSession";
import type { RoomType } from "../../entities/room";
import type { CallParticipantResponse } from "./CallParticipantResponse";

export interface ActiveCallResponse {
	callId: number;
	chatRoomId: number;
	roomId: number;
	roomType: RoomType;
	status: CallSessionStatus;
	liveKitRoomName: string;
	hostUsername: string;
	callerUsername: string;
	callType: string;
	participantsCount?: number;
	participants: CallParticipantResponse[];
	startedAt: string | null;
	activatedAt: string | null;
	createAt: string | null;
}
