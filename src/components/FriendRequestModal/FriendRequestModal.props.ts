export interface FriendRequestModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSubmit: (username: string) => void;
}
