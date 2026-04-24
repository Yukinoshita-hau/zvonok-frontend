import type { UserShort } from "../../entities/userShort";

export interface UserProfileUpdatedEvent {
	type: "USER_PROFILE_UPDATED";
	payload: UserShort;
}
