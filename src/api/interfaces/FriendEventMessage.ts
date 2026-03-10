import type { FriendRequest } from "./FriendRequest";

type friendEventType = "FRIEND_REQUEST_CREATED" | "FRIEND_REQUEST_ACCEPTED" |
	"FRIEND_REQUEST_REJECTED" | "FRIEND_REQUEST_CANCELLED" | "FRIEND_DELETE";

export interface FriendEventMessage {
	type: friendEventType;
	payload: FriendRequest | null;
}
