export interface CallTokenDto {
	mediaOwnership?: "OWNED" | "PASSIVE";
	serverUrl: string | null;
	participantToken: string | null;
	callId: number;
	expiresAt?: string;
	startedAt?: string | null;
	activatedAt?: string | null;
}
