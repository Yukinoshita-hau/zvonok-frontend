import type { Friend } from "../entities/friend";
import { api } from "./api";
import type { FriendApiInterface } from "./interfaces/FriendApiInterface";

const FRIEND_API_PREFIX = "/friends"

export const friendApi: FriendApiInterface = {
	myFriends: () => api.get<Friend[]>(`${FRIEND_API_PREFIX}`)
}
