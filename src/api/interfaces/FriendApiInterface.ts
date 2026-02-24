import type { AxiosResponse } from "axios";
import type { Friend } from "../../entities/friend";
import type { FriendRequest } from "./FriendRequest";


export interface FriendApiInterface {
	myFriends: () => Promise<AxiosResponse<Friend[]>>;
	incomingRequests: () => Promise<AxiosResponse<FriendRequest[]>>;
	outgoingRequests: () => Promise<AxiosResponse<FriendRequest[]>>;
	sendRequest: (receiverUsername: string) => Promise<AxiosResponse<FriendRequest>>
	acceptRequest: (requestId: number) => Promise<AxiosResponse<Friend>>
	rejectRequest: (requestId: number) => Promise<AxiosResponse<FriendRequest>>
	cancelRequest: (requestId: number) => Promise<AxiosResponse<FriendRequest>>
}
