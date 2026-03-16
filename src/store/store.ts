import { configureStore } from "@reduxjs/toolkit";
import userSlice from "./slices/user.slice";
import serverSlice from "./slices/server.slice";
import { setStore } from "../api/api";
import roomSlice from "./slices/room.slice";
import messageSlice from "./slices/message.slice";
import friendSlice from "./slices/friend.slice";
import websocketSlice from "./slices/websocket.slice";
import { websocketMiddleware } from "./middlewares/websocket.middleware";
import callSlice from "./slices/call.clice";
import notificationSlice from "./slices/notification.slice";
import toastSlice from "./slices/toast.slice";


export const store = configureStore({
	reducer: {
		user: userSlice,
		server: serverSlice,
		room: roomSlice,
		message: messageSlice,
		friend: friendSlice,
		websocket: websocketSlice,
		call: callSlice,
		notification: notificationSlice,
		toast: toastSlice
	},
	middleware: (getDefaultMiddleware) => {
		return getDefaultMiddleware().concat(websocketMiddleware)
	}
});

setStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
