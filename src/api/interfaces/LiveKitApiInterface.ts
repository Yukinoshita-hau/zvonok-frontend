import type { AxiosResponse } from "axios";
import type { LiveKitTokenDto } from "./LiveKitTokenDto";


export interface LiveKitApiInterface {
	getToken: (roomName: string) => Promise<AxiosResponse<LiveKitTokenDto>>
}
