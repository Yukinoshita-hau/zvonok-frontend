import type { AxiosResponse } from "axios";
import type { Room } from "../../entities/room";


export interface MessageApiResponse {
	getRoomMessages: () => Promise<AxiosResponse<Room[]>>
}
