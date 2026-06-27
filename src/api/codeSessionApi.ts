import { api } from "./api";
import type {
	CodeRunResultDto,
	CodeSessionDto,
	CreateCodeSessionRequestDto,
} from "./interfaces/codeSessionTypes";

export const codeSessionApi = {
	createSession: async (request: CreateCodeSessionRequestDto): Promise<CodeSessionDto> => {
		const { data } = await api.post<CodeSessionDto>("/code-sessions", request);
		return data;
	},

	getActiveSession: async (callSessionId: number): Promise<CodeSessionDto | null> => {
		const { data } = await api.get<CodeSessionDto | null>("/code-sessions/active", {
			params: { callSessionId },
		});
		return data;
	},

	grantEditor: async (sessionId: number, username: string): Promise<CodeSessionDto> => {
		const { data } = await api.post<CodeSessionDto>(`/code-sessions/${sessionId}/grant-editor`, { username });
		return data;
	},

	revokeEditor: async (sessionId: number): Promise<CodeSessionDto> => {
		const { data } = await api.post<CodeSessionDto>(`/code-sessions/${sessionId}/revoke-editor`);
		return data;
	},

	runSession: async (sessionId: number): Promise<CodeRunResultDto | null> => {
		const { data } = await api.post<CodeRunResultDto | null>(`/code-sessions/${sessionId}/run`);
		return data ?? null;
	},

	closeSession: async (sessionId: number): Promise<void> => {
		await api.post(`/code-sessions/${sessionId}/close`);
	},
};
