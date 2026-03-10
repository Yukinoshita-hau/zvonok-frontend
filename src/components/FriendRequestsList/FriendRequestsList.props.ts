import type { FriendRequest } from "../../api/interfaces/FriendRequest";


export interface FriendRequestsListProps {
	requestsList: FriendRequest[];
	mode: "incoming" | "outgoing";
}
