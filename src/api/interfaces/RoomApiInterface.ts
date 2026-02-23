import type { AxiosResponse } from "axios";
import type { Room } from "../../entities/room";
import type { GetRoomMessageParams } from "./GetRoomMessagesParams";
import type { ShortMessage } from "../../entities/shortMessage";


export interface RoomApiInterface {
	myRooms: () => Promise<AxiosResponse<Room[]>>
	getRoomMessage: (params: GetRoomMessageParams) => Promise<AxiosResponse<ShortMessage[]>>
}
