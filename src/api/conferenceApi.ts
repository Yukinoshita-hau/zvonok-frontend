import { api } from "./api";
import type { ConferenceApiInterface } from "./interfaces/ConferenceApiInterface";

export const conferenceApi: ConferenceApiInterface = {
	createConference: () => api.post("/conferences"),
	joinConference: (code: string) => api.post(`/conferences/${code}/join`),
	endConference: (code: string) => api.post(`/conferences/${code}/end`),
};
