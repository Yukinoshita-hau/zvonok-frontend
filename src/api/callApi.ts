import { api } from "./api";
import type { CallApiInterface } from "./interfaces/CallApiInterface";
import type { CallTokenDto } from "./interfaces/CallTokenDto";
import type { RestoreCallSessionResponse } from "./interfaces/RestoreCallSessionResponse";
import { mediaHeaders } from "./mediaClient";

export const callApi: CallApiInterface = {
	getCallToken: (callId: number, transfer = false) => api.post<CallTokenDto>(`/calls/${callId}/token`, undefined, { headers: mediaHeaders, params: { transfer } }),
	renewMedia: (callId: number, clientId = mediaHeaders["X-Media-Client-Id"]) => api.post<string>(`/calls/${callId}/media/renew`, undefined, { headers: { "X-Media-Client-Id": clientId }, timeout: 5000 }),
	releaseMedia: (callId: number, clientId = mediaHeaders["X-Media-Client-Id"]) => api.post(`/calls/${callId}/media/release`, undefined, { headers: { "X-Media-Client-Id": clientId }, adapter: "fetch", fetchOptions: { keepalive: true }, timeout: 3000 }),
	restoreCallSession: () => api.get<RestoreCallSessionResponse>("/calls/restore", { headers: mediaHeaders }),
	getActiveCallByRoomId: (roomId: number) => api.get(`/rooms/${roomId}/active-call`),
	joinCall: (dto) => api.post("/calls/join", dto),
	acceptCall: (dto) => api.post("/calls/accept", dto),
	declineCall: (dto) => api.post("/calls/decline", dto),
	leaveCall: (dto) => api.post("/calls/leave", dto),
	endCall: (dto) => api.post("/calls/end", dto),
};
