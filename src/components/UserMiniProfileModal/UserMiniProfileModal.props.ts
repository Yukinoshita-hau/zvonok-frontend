export interface UserMiniProfileModalProps {
	userId: number | null;
	isOpen: boolean;
	onClose: () => void;
	fallbackUser?: {
		username?: string | null;
		displayName?: string | null;
		avatarUrl?: string | null;
		incomingRequestId?: number | null;
	};
}
