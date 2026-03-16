import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { Notification } from "../interfaces/notification.interface";


interface NotificationState {
	notifications: Notification[];
}

const initialState: NotificationState = {
	notifications: []
}

const notificationSlice = createSlice({
	name: "notification",
	initialState: initialState,
	reducers: {
		pushNotification: (previousState, action: PayloadAction<{
			notification: Notification
		}>) => {
			previousState.notifications.unshift(action.payload.notification)
		},
		markAsRead: (previousState, action: PayloadAction<{
			id: string;
		}>) => {
			const notification = previousState.notifications.find(n => n.id === action.payload.id);
			if (notification) notification.read = true;
		},
		markAllIsRead: (previousState) => {
			previousState.notifications.forEach(n => {
				n.read = true;
			});
		},
		removeNotification: (previousState, action: PayloadAction<{
			id: string;
		}>) => {
			previousState.notifications = previousState.notifications.filter(n => n.id !== action.payload.id);
		},
		clearNotifications: (previousState) => {
			previousState.notifications = [];
		}

	}
})

export default notificationSlice.reducer;
export const notificationAction = notificationSlice.actions;
