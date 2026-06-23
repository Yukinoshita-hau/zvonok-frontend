import type { AxiosResponse } from "axios";
import type { ConferenceCreateResponse, ConferenceJoinResponse } from "./ConferenceDtos";

export interface ConferenceApiInterface {
	createConference: () => Promise<AxiosResponse<ConferenceCreateResponse>>;
	joinConference: (code: string) => Promise<AxiosResponse<ConferenceJoinResponse>>;
	endConference: (code: string) => Promise<AxiosResponse<void>>;
}
