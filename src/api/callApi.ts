import { api } from "./api";
import type { CallApiInterface } from "./interfaces/CallApiInterface";
import type { CallTokenDto } from "./interfaces/CallTokenDto";

export const callApi: CallApiInterface = {
	getCallToken: (callId: number) => api.post<CallTokenDto>(`/calls/${callId}/token`),
};
