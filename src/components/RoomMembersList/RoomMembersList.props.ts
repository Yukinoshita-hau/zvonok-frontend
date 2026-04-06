import type { RoomMembers } from "../../entities/roomMember";

export interface RoomMembersListProps {
	members: RoomMembers[];
	myUserId?: number;
}
