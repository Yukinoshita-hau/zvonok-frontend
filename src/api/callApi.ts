import { api } from "./api";
import type { CallApiInterface } from "./interfaces/CallApiInterface";
import type { CallTokenDto } from "./interfaces/CallTokenDto";
import type { RestoreCallSessionResponse } from "./interfaces/RestoreCallSessionResponse";

export const callApi: CallApiInterface = {
	getCallToken: (callId: number) => api.post<CallTokenDto>(`/calls/${callId}/token`),
	restoreCallSession: () => api.get<RestoreCallSessionResponse>("/calls/restore"),
	getActiveCallByRoomId: (roomId: number) => api.get(`/rooms/${roomId}/active-call`),
	joinCall: (dto) => api.post("/calls/join", dto),
	acceptCall: (dto) => api.post("/calls/accept", dto),
	declineCall: (dto) => api.post("/calls/decline", dto),
	leaveCall: (dto) => api.post("/calls/leave", dto),
	endCall: (dto) => api.post("/calls/end", dto),
};
