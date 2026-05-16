
export type CallParticipantStatus = "RINGING" | "ACCEPTED" | "JOINED" | "DECLINED" | "LEFT"

export interface CallParticipantResponse {
	userId: string;
	username: string;
	displayName: string;
	avatarUrl: string;
	status: CallParticipantStatus;
	joinedAt: string;
	acceptedAt: string;
	leftAt: string;
}
