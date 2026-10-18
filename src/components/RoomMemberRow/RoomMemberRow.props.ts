import type { UserSummary } from "../../entities/UserMini";

export interface RoomMemberRowProps {
	member: UserSummary;
	isCurrentUser: boolean;
	onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
}
