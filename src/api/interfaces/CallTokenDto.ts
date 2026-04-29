export interface CallTokenDto {
	serverUrl: string;
	participantToken: string;
	callId: number;
	expiresAt?: string;
}
