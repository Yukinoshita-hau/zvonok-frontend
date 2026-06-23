export interface ConferenceCreateResponse {
	conferenceId: number;
	code: string;
	joinUrl: string;
	livekitRoomName: string;
	serverUrl: string;
	token: string;
}

export interface ConferenceJoinResponse {
	conferenceId: number;
	code: string;
	livekitRoomName: string;
	serverUrl: string;
	token: string;
}

export interface ConferenceApiErrorResponse {
	message: string;
	status: number;
}
