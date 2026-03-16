import type { AxiosResponse } from "axios";
import type { Room } from "../../entities/room";
import type { GetRoomMessageParams } from "./GetRoomMessagesParams";
import type { ShortMessage } from "../../entities/shortMessage";
import type { CreateGroupBody } from "./CreateGroupBody";


export interface RoomApiInterface {
	myRooms: () => Promise<AxiosResponse<Room[]>>
	getRoomMessage: (params: GetRoomMessageParams) => Promise<AxiosResponse<ShortMessage[]>>;
	createGroup: (body: CreateGroupBody) => Promise<AxiosResponse<Room[]>>;
	markRoomRead: (params: { roomId: number }) => Promise<AxiosResponse<void>> }
