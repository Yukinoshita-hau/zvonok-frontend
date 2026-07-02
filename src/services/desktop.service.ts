export interface DesktopNotificationPayload {
	title: string;
	body?: string;
	roomId?: string | number;
	userId?: string | number;
	callId?: string | number;
	type?: "message" | "call" | "friend_request" | "room";
}

export function isDesktop() {
	return Boolean(window.zvonokDesktop);
}

export function isAppFocused() {
	return typeof document !== "undefined" && document.hasFocus();
}

export function showDesktopNotification(payload: DesktopNotificationPayload) {
	return window.zvonokDesktop?.notifications?.showNotification(payload) ?? Promise.resolve();
}

export function onDesktopNotificationClicked(
	callback: (payload: DesktopNotificationPayload) => void
) {
	return window.zvonokDesktop?.notifications?.onNotificationClicked(callback) ?? (() => {});
}
