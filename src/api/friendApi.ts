import type { Friend } from "../entities/friend";
import { api } from "./api";
import type { FriendApiInterface } from "./interfaces/FriendApiInterface";
import type { FriendRequest } from "./interfaces/FriendRequest";

const FRIEND_API_PREFIX = "/friends"

export const friendApi: FriendApiInterface = {
	myFriends: () => api.get<Friend[]>(`${FRIEND_API_PREFIX}`),
	incomingRequests: () => api.get<FriendRequest[]>(`${FRIEND_API_PREFIX}/requests/incoming`),
	outgoingRequests: () => api.get<FriendRequest[]>(`${FRIEND_API_PREFIX}/requests/outgoing`),
	sendRequest: (receiverUsername: string) => api.post<FriendRequest>(`${FRIEND_API_PREFIX}/requests`, { receiverUsername }),
	acceptRequest: (requestId: number) => api.post<Friend>(`${FRIEND_API_PREFIX}/requests/${requestId}/accept`),
	rejectRequest: (requestId: number) => api.post<FriendRequest>(`${FRIEND_API_PREFIX}/requests/${requestId}/reject`),
	cancelRequest: (requestId: number) => api.post<FriendRequest>(`${FRIEND_API_PREFIX}/requests/${requestId}/cancel`)
}
