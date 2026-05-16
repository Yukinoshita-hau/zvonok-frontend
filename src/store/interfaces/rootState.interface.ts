import type callSlice from "../slices/call.slice";
import type friendSlice from "../slices/friend.slice";
import type messageSlice from "../slices/message.slice";
import type roomSlice from "../slices/room.slice";
import type serverSlice from "../slices/server.slice";
import type userSlice from "../slices/user.slice";
import type websocketSlice from "../slices/websocket.slice";


export interface RootState {
	user: ReturnType<typeof userSlice>
	server: ReturnType<typeof serverSlice>,
	room: ReturnType<typeof roomSlice>,
	message: ReturnType<typeof messageSlice>,
	friend: ReturnType<typeof friendSlice>,
	websocket: ReturnType<typeof websocketSlice>,
	call: ReturnType<typeof callSlice>
}

export type AppDispatch = (action: any) => any;
