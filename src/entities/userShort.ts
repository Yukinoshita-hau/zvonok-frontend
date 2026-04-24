import type { UserStatus } from "./interfaces/UserStatus";

export interface UserShort {
	id: number;
	username: string;
	displayName: string;
	avatarUrl: string | null;
	aboutMe?: string;
	status: UserStatus;
	lastSeenAt: string;
	updatedAt: string;
	createdAt: string;
}
