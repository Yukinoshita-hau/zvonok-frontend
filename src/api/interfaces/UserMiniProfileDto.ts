import type { UserStatus } from "../../entities/interfaces/UserStatus";

export type FriendshipStatus =
	"SELF" |
	"NOT_FRIENDS" |
	"REQUEST_SENT" |
	"REQUEST_RECEIVED" |
	"FRIENDS";

export interface UserMiniProfileDto {
	id: number;
	username: string;
	displayName: string;
	avatarUrl: string | null;
	status: UserStatus;
	lastSeenAt: string | null;
	bio?: string | null;
	about?: string | null;
	friendshipStatus: FriendshipStatus;
	privateRoomId?: number | null;
	incomingRequestId?: number | null;
}
