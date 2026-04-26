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
