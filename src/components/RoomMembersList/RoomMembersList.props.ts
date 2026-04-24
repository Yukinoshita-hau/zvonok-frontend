import type { RoomMemberShort } from "../../entities/roomMember";

export interface RoomMembersListProps {
	members: RoomMemberShort[];
	myUserId?: number;
}
