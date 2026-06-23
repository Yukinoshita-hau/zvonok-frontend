export type CallParticipantStatus = "RINGING" | "ACCEPTED" | "JOINED" | "DECLINED" | "LEFT";

export interface CallParticipantResponse {
	userId: number;
	username: string;
	displayName: string | null;
	avatarUrl: string | null;
	status: CallParticipantStatus;
	joinedAt: string | null;
	acceptedAt: string | null;
	leftAt: string | null;
}
