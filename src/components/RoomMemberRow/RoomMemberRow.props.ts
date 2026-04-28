import type { UserMini } from "../../entities/UserMini";

export interface RoomMemberRowProps {
	member: UserMini;
	isCurrentUser: boolean;
	onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
}
