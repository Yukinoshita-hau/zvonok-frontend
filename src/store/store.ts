import { combineReducers, configureStore, type UnknownAction } from "@reduxjs/toolkit";
import userSlice from "./slices/user.slice";
import serverSlice from "./slices/server.slice";
import { setStore } from "../api/api";
import roomSlice from "./slices/room.slice";
import messageSlice from "./slices/message.slice";
import friendSlice from "./slices/friend.slice";
import websocketSlice from "./slices/websocket.slice";
import { websocketMiddleware } from "./middlewares/websocket.middleware";
import callSlice from "./slices/call.slice";
import notificationSlice from "./slices/notification.slice";
import toastSlice from "./slices/toast.slice";
import deviceSlice from "./slices/device.slice";
import uiSlice from "./slices/ui.slice";
import channelMessageSlice from "./slices/channelMessage.slice";
import usersSlice from "./slices/users.slice";


const appReducer = combineReducers({
	user: userSlice,
	users: usersSlice,
	server: serverSlice,
	room: roomSlice,
	message: messageSlice,
	channelMessage: channelMessageSlice,
	friend: friendSlice,
	websocket: websocketSlice,
	call: callSlice,
	notification: notificationSlice,
	toast: toastSlice,
	device: deviceSlice,
	ui: uiSlice
});

const rootReducer = (state: ReturnType<typeof appReducer> | undefined, action: UnknownAction) => {
	if (action.type == "user/logout") {
		state = undefined;
	}

	return appReducer(state, action);
}

export const store = configureStore({
	reducer: rootReducer,
	middleware: (getDefaultMiddleware) => {
		return getDefaultMiddleware().concat(websocketMiddleware)
	}
})

setStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
