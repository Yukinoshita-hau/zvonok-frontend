import type { UserSummary } from "../../entities/UserMini";

export interface RoomMembersPanelProps {
	members: UserSummary[];
	myUserId?: number;
	onMemberSelect: (member: UserSummary, anchorRect: DOMRect) => void;
}
