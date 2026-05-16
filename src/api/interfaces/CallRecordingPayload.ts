export type CallRecordingAction = "RECORDING_START" | "RECORDING_STOP";

export interface CallRecordingPayload {
	action: CallRecordingAction;
	sessionId: number;
}
