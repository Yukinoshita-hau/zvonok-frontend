import type { AxiosResponse } from "axios";
import type { RoomResponse } from "../../entities/room";
import type { GetRoomMessageParams } from "./GetRoomMessagesParams";
import type { ShortMessageResponse } from "../../entities/shortMessage";
import type { CreateGroupBody } from "./CreateGroupBody";
import type { ActiveCallResponse } from "./ActiveCallResponse";
import type {
	AddRoomMembersRequest,
	AddRoomMembersResponse,
	CreateRoomInviteResponse,
} from "./RoomManagementDtos";


export interface RoomApiInterface {
	myRooms: () => Promise<AxiosResponse<RoomResponse[]>>;
	getRoomMessage: (params: GetRoomMessageParams) => Promise<AxiosResponse<ShortMessageResponse[]>>;
	createGroup: (body: CreateGroupBody) => Promise<AxiosResponse<RoomResponse>>;
	markRoomRead: (params: { roomId: number }) => Promise<AxiosResponse<void>>;
	getActiveCall: (params: { roomId: number }) => Promise<AxiosResponse<ActiveCallResponse>>;
	clearRoomMessages: (params: { roomId: number }) => Promise<AxiosResponse<void>>;
	addRoomMembers: (
		roomId: number,
		body: AddRoomMembersRequest
	) => Promise<AxiosResponse<AddRoomMembersResponse>>;
	createInvite: (roomId: number) => Promise<AxiosResponse<CreateRoomInviteResponse>>;
	leaveRoom: (roomId: number) => Promise<AxiosResponse<void>>;
}
