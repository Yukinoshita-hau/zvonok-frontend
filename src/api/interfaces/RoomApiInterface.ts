import type { AxiosResponse } from "axios";
import type { RoomApiResponse } from "../../entities/room";
import type { GetRoomMessageParams } from "./GetRoomMessagesParams";
import type { ShortMessage } from "../../entities/shortMessage";
import type { CreateGroupBody } from "./CreateGroupBody";


export interface RoomApiInterface {
	myRooms: () => Promise<AxiosResponse<RoomApiResponse[]>>
	getRoomMessage: (params: GetRoomMessageParams) => Promise<AxiosResponse<ShortMessage[]>>;
	createGroup: (body: CreateGroupBody) => Promise<AxiosResponse<RoomApiResponse[]>>;
	markRoomRead: (params: { roomId: number }) => Promise<AxiosResponse<void>>
}
