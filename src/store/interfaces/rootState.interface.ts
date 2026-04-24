import type callSlice from "../slices/call.slice";
import type channelMessageSlice from "../slices/channelMessage.slice";
import type deviceSlice from "../slices/device.slice";
import type friendSlice from "../slices/friend.slice";
import type messageSlice from "../slices/message.slice";
import type notificationSlice from "../slices/notification.slice";
import type roomSlice from "../slices/room.slice";
import type serverSlice from "../slices/server.slice";
import type toastSlice from "../slices/toast.slice";
import type uiSlice from "../slices/ui.slice";
import type userSlice from "../slices/user.slice";
import type usersSlice from "../slices/users.slice";
import type websocketSlice from "../slices/websocket.slice";

export interface RootState {
	user: ReturnType<typeof userSlice>;
	users: ReturnType<typeof usersSlice>;
	server: ReturnType<typeof serverSlice>;
	room: ReturnType<typeof roomSlice>;
	message: ReturnType<typeof messageSlice>;
	channelMessage: ReturnType<typeof channelMessageSlice>;
	friend: ReturnType<typeof friendSlice>;
	websocket: ReturnType<typeof websocketSlice>;
	call: ReturnType<typeof callSlice>;
	notification: ReturnType<typeof notificationSlice>;
	toast: ReturnType<typeof toastSlice>;
	device: ReturnType<typeof deviceSlice>;
	ui: ReturnType<typeof uiSlice>;
}

export type AppDispatch = any;
