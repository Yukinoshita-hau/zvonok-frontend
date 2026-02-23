import type { UserStatus } from "./interfaces/UserStatus";

export interface Friend {
	friendshipId: number;
	friendId: number;
	friendUsername: string;
	friendAvatarUrl: string | null;
	friendStatus: UserStatus;
	friendshipSince: string;
}
