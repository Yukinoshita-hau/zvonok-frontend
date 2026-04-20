import type { Friend } from "../../entities/friend";

export interface FriendListItemProps {
	friend: Friend
	onClick: (displayName: string) => void;
}
