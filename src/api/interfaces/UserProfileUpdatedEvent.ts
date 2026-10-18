export interface UserProfileUpdate {
	id: number;
	username: string;
	displayName: string;
	avatarUrl: string | null;
	aboutMe: string | null;
}
export interface UserProfileUpdatedEvent {
	type?: "USER_PROFILE_UPDATED";
	eventType?: "USER_PROFILE_UPDATED";
	user: UserProfileUpdate;
}
