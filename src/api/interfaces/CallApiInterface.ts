import type { AxiosResponse } from "axios";
import type { CallTokenDto } from "./CallTokenDto";

export interface CallApiInterface {
	getCallToken: (callId: number) => Promise<AxiosResponse<CallTokenDto>>;
}
