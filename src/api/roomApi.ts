import type { Room } from "../entities/room";
import { api } from "./api";
import type { GetRoomMessageParams } from "./interfaces/GetRoomMessagesParams";
import type { RoomApiInterface } from "./interfaces/RoomApiInterface";

const ROOM_API_PREFIX = "/rooms"

export const roomApi: RoomApiInterface = {
	myRooms: () => api.get<Room[]>(`${ROOM_API_PREFIX}/all`),
	getRoomMessage: ({ beforeMessageId, limit = 15, roomId }: GetRoomMessageParams) => api.get(`${ROOM_API_PREFIX}/${roomId}/messages`, {
		params: {
			beforeMessageId,
			limit
		}
	})
}
