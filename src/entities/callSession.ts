import type { Room, RoomType } from "./room";
import type { User } from "./user";

export type CallSessionStatus = "RINGING" | "ACTIVE" | "ENDED";

export type CallEndReason =
	"HOST_ENDED" |
	"USER_LEFT" |
	"NO_ACTIVE_PARTICIPANTS" |
	"LIVEKIT_ROOM_MISSING" |
	"STALE_CLEANUP" |
	"DECLINED" |
	"CANCELLED"

export interface CallSession {
	id: number;
	room: Room;
	roomType: RoomType;
	livekitRoomName: string;
	status: CallSessionStatus;
	createdBy: User;
	hostUser: User;
	startedAt: string;
	activatedAt: string;
	livekitRoomReadyAt: string;
	endedAt: string;
	endedByUser: User;
	CallEndReason: CallEndReason;
	createdAt: string;
	updatedAt: string;
}
