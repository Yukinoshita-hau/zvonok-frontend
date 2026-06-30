import type { RoomType } from "../../entities/room";

export type InviteStatus =
	"ACTIVE" |
	"EXPIRED" |
	"ALREADY_MEMBER" |
	"INVALID";

export interface InvitePreviewDto {
	token: string;
	roomId: number;
	roomName: string;
	roomType: RoomType;
	roomAvatarUrl?: string | null;
	membersCount: number;
	createdByUsername?: string | null;
	createdByDisplayName?: string | null;
	status: InviteStatus;
	expiresAt?: string | null;
}

export interface InviteJoinResponseDto {
	roomId: number;
	roomName?: string | null;
}
