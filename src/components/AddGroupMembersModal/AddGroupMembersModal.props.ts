import type { Friend } from "../../entities/friend";

export interface AddGroupMembersModalProps {
	isOpen: boolean;
	friends: Friend[];
	existingMemberIds: number[];
	isSubmitting?: boolean;
	onClose: () => void;
	onAdd: (userIds: number[]) => void;
}
