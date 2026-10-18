import { combineReducers, configureStore, type UnknownAction, type ThunkDispatch, type Dispatch } from "@reduxjs/toolkit";
import userSlice from "./slices/user.slice";
import { setStore } from "../api/api";
import { sessionMiddleware } from "./middlewares/session.middleware";
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
import usersSlice from "./slices/users.slice";
import activeCallSlice from "./slices/activeCall.slice";


const appReducer = combineReducers({
	user: userSlice,
	users: usersSlice,
	room: roomSlice,
	message: messageSlice,
	friend: friendSlice,
	websocket: websocketSlice,
	call: callSlice,
	activeCall: activeCallSlice,
	notification: notificationSlice,
	toast: toastSlice,
	device: deviceSlice,
	ui: uiSlice
});

const rootReducer = (state: ReturnType<typeof appReducer> | undefined, action: UnknownAction) => {
	if (action.type === "user/sessionCleared") {
		state = undefined;
	}
	const result = appReducer(state, action);
	if (action.type === "user/sessionCleared") return { ...result, user: { ...result.user, isAuthChecked: true } };
	return result;
}

export const store = configureStore({
	reducer: rootReducer,
	middleware: (getDefaultMiddleware) => {
		return getDefaultMiddleware().concat(sessionMiddleware, websocketMiddleware)
	}
})

setStore(store);

export type RootState = ReturnType<typeof appReducer>;
export type AppDispatch = ThunkDispatch<RootState, undefined, UnknownAction> & Dispatch<UnknownAction>;
