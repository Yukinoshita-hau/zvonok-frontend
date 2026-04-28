import type { UserMini } from "../../entities/UserMini";

export interface RoomMembersPanelProps {
	members: UserMini[];
	myUserId?: number;
	onMemberSelect: (member: UserMini, anchorRect: DOMRect) => void;
}
