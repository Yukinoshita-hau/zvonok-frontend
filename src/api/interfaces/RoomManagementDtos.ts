import type { RoomResponse } from "../../entities/room";
import type { UserMini } from "../../entities/UserMini";

export interface AddRoomMembersRequest {
	userIds: number[];
}

export interface AddRoomMembersResponse {
	room?: RoomResponse;
	addedMembers?: UserMini[];
	skippedUserIds?: number[];
	skipped?: UserMini[];
}

export interface CreateRoomInviteResponse {
	token?: string | null;
	inviteToken?: string | null;
	inviteCode?: string | null;
	code?: string | null;
	url?: string | null;
	inviteUrl?: string | null;
	expiresAt?: string | null;
}
