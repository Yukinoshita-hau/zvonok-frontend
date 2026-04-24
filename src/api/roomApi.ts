import type { RoomApiResponse } from "../entities/room";
import { api } from "./api";
import type { CreateGroupBody } from "./interfaces/CreateGroupBody";
import type { GetRoomMessageParams } from "./interfaces/GetRoomMessagesParams";
import type { RoomApiInterface } from "./interfaces/RoomApiInterface";

const ROOM_API_PREFIX = "/rooms"

export const roomApi: RoomApiInterface = {
	myRooms: () => api.get<RoomApiResponse[]>(`${ROOM_API_PREFIX}/all`),
	getRoomMessage: ({ beforeMessageId, limit = 15, roomId }: GetRoomMessageParams) => api.get(`${ROOM_API_PREFIX}/${roomId}/messages`, {
		params: {
			beforeMessageId,
			limit
		}
	}),
	createGroup: (body: CreateGroupBody) => api.post<RoomApiResponse[]>(`${ROOM_API_PREFIX}/createGroup`, body),
	markRoomRead: ({ roomId }) => api.post(`${ROOM_API_PREFIX}/${roomId}/read`)
}
