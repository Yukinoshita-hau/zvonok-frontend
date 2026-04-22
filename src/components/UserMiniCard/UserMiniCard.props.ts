export type UserCardRelationship = "self" | "friend" | "outgoing" | "incoming" | "none";

export interface UserMiniCardProps {
	isOpen: boolean;
	displayName: string;
	username: string;
	avatarUrl?: string | null;
	statusLabel?: string;
	aboutMe?: string | null;
	avatarBg: string;
	relationship: UserCardRelationship;
	anchorRect: DOMRect | null;
	onClose: () => void;
	onMessage?: () => void;
	onAddFriend?: () => void;
	onRemoveFriend?: () => void;
}
