import type { UserStatus } from "./interfaces/UserStatus";


export interface User {
	id: number,
	username: string;
	displayName: string;
	aboutMe: string | null;
	email: string;
	isEmailVerified: boolean;
	status: UserStatus;
	lastSeenAt: string | null;
	avatarUrl: string | null;
	updatedAt: string;
	createdAt: string;
}
