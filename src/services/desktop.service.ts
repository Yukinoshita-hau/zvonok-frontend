import type { DesktopWindowState } from '../../electron/desktopTypes';

let nativeWindowState: DesktopWindowState | undefined;
let windowEventReceived = false;
const lifecycle = typeof window !== 'undefined' ? window.zvonokDesktop?.lifecycle : undefined;
lifecycle?.onWindowState?.(state => { windowEventReceived = true; nativeWindowState = state; });
void lifecycle?.getWindowState?.().then(state => { if (!windowEventReceived) nativeWindowState = state; }).catch(() => {});

export interface DesktopNotificationPayload {
	title: string;
	body?: string;
	silent?: boolean;
	roomId?: string | number;
	userId?: string | number;
	callId?: string | number;
	type?: "message" | "call" | "friend_request" | "room";
}

export function isDesktop() {
	return Boolean(window.zvonokDesktop);
}

export function isAppFocused() {
	// Hidden Electron windows can retain document focus and report visible.
	if (lifecycle?.getWindowState) return !!nativeWindowState?.focused && nativeWindowState.visible && !nativeWindowState.minimized;
	return typeof document !== "undefined" && document.hasFocus();
}

const browserClickListeners = new Set<(payload: DesktopNotificationPayload) => void>();
export async function showDesktopNotification(payload: DesktopNotificationPayload) {
	if (window.zvonokDesktop?.notifications) return window.zvonokDesktop.notifications.showNotification(payload);
	if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
	const notification = new Notification(payload.title, {body: payload.body, silent: payload.silent});
	notification.onclick = () => {
		window.focus();
		browserClickListeners.forEach(listener => listener(payload));
		notification.close();
	};
}

export function onDesktopNotificationClicked(
	callback: (payload: DesktopNotificationPayload) => void
) {
	if (window.zvonokDesktop?.notifications) return window.zvonokDesktop.notifications.onNotificationClicked(callback);
	browserClickListeners.add(callback);
	return () => { browserClickListeners.delete(callback); };
}
