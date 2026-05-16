import type { AxiosResponse } from "axios";
import type { CallTokenDto } from "./CallTokenDto";
import type { RestoreCallSessionResponse } from "./RestoreCallSessionResponse";

export interface CallApiInterface {
	getCallToken: (callId: number) => Promise<AxiosResponse<CallTokenDto>>;
	restoreCallSession: () => Promise<AxiosResponse<RestoreCallSessionResponse>>
}
