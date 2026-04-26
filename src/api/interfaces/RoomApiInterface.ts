import type { AxiosResponse } from "axios";
import type { Room, RoomResponse } from "../../entities/room";
import type { GetRoomMessageParams } from "./GetRoomMessagesParams";
import type { ShortMessage, ShortMessageResponse } from "../../entities/shortMessage";
import type { CreateGroupBody } from "./CreateGroupBody";


export interface RoomApiInterface {
	myRooms: () => Promise<AxiosResponse<RoomResponse[]>>
	getRoomMessage: (params: GetRoomMessageParams) => Promise<AxiosResponse<ShortMessageResponse[]>>;
	createGroup: (body: CreateGroupBody) => Promise<AxiosResponse<RoomResponse>>;
	markRoomRead: (params: { roomId: number }) => Promise<AxiosResponse<void>>
}
