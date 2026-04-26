import type { UserMini } from "../../entities/UserMini";

export interface UserProfileUpdatedEvent {
	type?: "USER_PROFILE_UPDATED";
	eventType?: "USER_PROFILE_UPDATED";
	user: UserMini;
}
