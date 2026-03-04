import { api } from "./api";
import type { LiveKitApiInterface } from "./interfaces/LiveKitApiInterface";
import type { LiveKitTokenDto } from "./interfaces/LiveKitTokenDto";

const LIVEKIT_API_PREFIX = "/livekit";

export const livekitApi: LiveKitApiInterface = {
	getToken: (roomName: string) => api.get<LiveKitTokenDto>(`${LIVEKIT_API_PREFIX}/token`, {
		params: { room: roomName }
	})
} 
