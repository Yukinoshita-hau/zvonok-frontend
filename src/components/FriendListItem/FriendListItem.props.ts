import type { Friend } from "../../entities/friend";

export interface FriendListItemProps {
	friend: Friend
	onClick: (friendId: number) => void;
}
