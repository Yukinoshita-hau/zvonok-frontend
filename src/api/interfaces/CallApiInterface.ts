import type { AxiosResponse } from "axios";
import type { CallTokenDto } from "./CallTokenDto";
import type { RestoreCallSessionResponse } from "./RestoreCallSessionResponse";
import type { ActiveCallResponse } from "./ActiveCallResponse";
import type { AcceptCallDto, DeclineCallDto, EndCallDto, JoinCallDto, LeaveCallDto } from "./CallDtos";

export interface CallApiInterface {
	getCallToken: (callId: number) => Promise<AxiosResponse<CallTokenDto>>;
	restoreCallSession: () => Promise<AxiosResponse<RestoreCallSessionResponse>>;
	getActiveCallByRoomId: (roomId: number) => Promise<AxiosResponse<ActiveCallResponse | null>>;
	joinCall: (dto: JoinCallDto) => Promise<AxiosResponse<ActiveCallResponse>>;
	acceptCall: (dto: AcceptCallDto) => Promise<AxiosResponse<ActiveCallResponse>>;
	declineCall: (dto: DeclineCallDto) => Promise<AxiosResponse<unknown>>;
	leaveCall: (dto: LeaveCallDto) => Promise<AxiosResponse<unknown>>;
	endCall: (dto: EndCallDto) => Promise<AxiosResponse<unknown>>;
}
