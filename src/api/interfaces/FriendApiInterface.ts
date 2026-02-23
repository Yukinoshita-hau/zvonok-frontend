import type { AxiosResponse } from "axios";
import type { Friend } from "../../entities/friend";


export interface FriendApiInterface {
	myFriends: () => Promise<AxiosResponse<Friend[]>>
}
