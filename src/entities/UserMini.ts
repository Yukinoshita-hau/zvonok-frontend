export type UserStatus =
	"ONLINE" |
	"OFFLINE" |
	"AWAY" |
	"BUSY" |
	"INVISIBLE"

export interface UserMini {
	id: number;
	username: string;
	displayName: string;
	status: UserStatus;
	lastSeenAt: string | null;
	avatarUrl: string | null;
	updatedAt: string;
	createdAt: string;
}

/** Message SenderDto omits profile timestamps; summaries in the normalized cache
 * can originate from either SenderDto or a complete RoomMemberShortDto. */
export type MessageSender = Pick<UserMini, "id" | "username" | "displayName" | "status" | "avatarUrl">;
export type UserSummary = MessageSender & Partial<Pick<UserMini, "lastSeenAt" | "updatedAt" | "createdAt">>;
